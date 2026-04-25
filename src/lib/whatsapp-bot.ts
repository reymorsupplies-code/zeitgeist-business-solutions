/**
 * ZBS WhatsApp Self-Service Bot for Tenants (Inquilinos)
 *
 * This bot allows tenants to interact with ZBS entirely via WhatsApp,
 * without needing the web portal or internet browser. It is designed
 * specifically for the Caribbean market where WhatsApp penetration is
 * near-universal and data connectivity can be unreliable.
 *
 * Supported commands:
 *   MENU / HOLA / INICIO    → Show main menu with options
 *   SALDO / BALANCE         → View rent balance and next payment
 *   PAGAR / PAY             → Request a WiPay payment link
 *   MANTENIMIENTO / MANTO   → Report a maintenance issue
 *   MIS SOLICITUDES          → View status of maintenance requests
 *   INFO / CONTRATO         → View lease/contract details
 *   CONTACTO                → View property manager contact info
 *   AYUDA / HELP            → Show help text
 *
 * Architecture:
 *   Incoming WhatsApp message → webhook → this bot processor → auto-reply
 *   The bot identifies the tenant by their WhatsApp phone number,
 *   matching it against the Renter.phone field in the database.
 *
 * Multi-language support: Spanish (default) and English.
 * Language is detected from tenant settings or auto-detected from first message.
 */

import { pgQuery, pgQueryOne } from './pg-query';
import {
  getWhatsAppConfig,
  sendTextMessage,
  sendListMessage,
  sendReplyButtons,
  logSentMessage,
  type WhatsAppSenderConfig,
  type InteractiveReplyOptions,
} from './whatsapp-sender';

// ─── Types ───

interface BotContext {
  tenantId: string;
  renterId: string;
  renterName: string;
  whatsappPhone: string;
  config: WhatsAppSenderConfig;
  language: 'es' | 'en';
  propertyId: string;
  propertyAddress: string;
  unitNumber: string;
}

interface MaintenanceState {
  step: 'category' | 'title' | 'description' | 'priority' | 'confirm';
  data: {
    category?: string;
    title?: string;
    description?: string;
    priority?: string;
  };
}

// In-memory session store (per phone number)
// In production, this should be Redis or similar
const activeSessions = new Map<string, {
  state: string;
  data: Record<string, any>;
  lastActivity: number;
}>();

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Language Strings ───

const STRINGS: Record<string, Record<string, string>> = {
  es: {
    welcome: 'Hola {name}! Bienvenido/a al asistente ZBS. Soy tu portal de inquilino por WhatsApp.',
    notRegistered: 'Lo sentimos, no encontramos tu cuenta de inquilino. Verifica que tu numero de telefono este registrado con tu propietario. Si crees que es un error, contacta a tu administrador de propiedad.',
    menuBody: 'Selecciona una opcion del menu:',
    menuFooter: 'Responde con el numero o escriba el comando.',
    optBalance: 'Ver saldo y proximo pago',
    optPay: 'Pagar renta',
    optMaintenance: 'Reportar mantenimiento',
    optRequests: 'Ver mis solicitudes',
    optInfo: 'Info de mi contrato',
    optContact: 'Contactar administrador',
    optHelp: 'Ayuda',
    optLanguage: 'Cambiar idioma / English',
    balanceTitle: 'Resumen de tu cuenta',
    noBalance: 'No tienes pagos pendientes. Todo al dia!',
    upcomingPayment: 'Proximo pago:',
    dueDate: 'Fecha limite:',
    amount: 'Monto:',
    status: 'Estado:',
    totalPaid: 'Total pagado:',
    totalPending: 'Total pendiente:',
    payInitiated: 'Te envio el enlace de pago a continuacion. Tienes 30 minutos para completarlo.',
    payError: 'Hubo un error al generar el enlace de pago. Por favor intenta mas tarde o contacta a tu administrador.',
    noPendingPayments: 'No tienes pagos pendientes. Todo al dia!',
    mantCategory: 'Selecciona la categoria del problema:',
    mantCategories: 'Categorias',
    mantGeneral: 'General',
    mantPlumbing: 'Plomeria',
    mantElectrical: 'Electrico',
    mantStructural: 'Estructural',
    mantHVAC: 'Aire acondicionado',
    mantTitle: 'Cual es el titulo o descripcion corta del problema?',
    mantDesc: 'Describe el problema con mas detalle (ubicacion, cuando empezo, severidad):',
    mantPriority: 'Selecciona la prioridad:',
    mantLow: 'Baja - No urgente',
    mantMedium: 'Media - Requiere atencion pronto',
    mantHigh: 'Alta - Necesita atencion rapida',
    mantUrgent: 'Urgente - Emergencia',
    mantConfirm: 'Confirmar solicitud de mantenimiento?',
    mantConfirmYes: 'Si, enviar',
    mantConfirmNo: 'Cancelar',
    mantSubmitted: 'Tu solicitud de mantenimiento ha sido enviada exitosamente. El numero de referencia es: {id}',
    requestsTitle: 'Tus solicitudes de mantenimiento',
    noRequests: 'No tienes solicitudes de mantenimiento activas.',
    infoTitle: 'Informacion de tu contrato',
    leaseStart: 'Inicio de contrato:',
    leaseEnd: 'Fin de contrato:',
    monthlyRent: 'Renta mensual:',
    property: 'Propiedad:',
    unit: 'Unidad:',
    contactTitle: 'Contacto del administrador',
    helpText: 'Puedes interactuarme con estos comandos:\n\n*MENU* - Ver el menu principal\n*SALDO* - Ver tu saldo\n*PAGAR* - Solicitar enlace de pago\n*MANTENIMIENTO* - Reportar un problema\n*MIS SOLICITUDES* - Ver solicitudes\n*INFO* - Info de contrato\n*CONTACTO* - Contactar admin\n*AYUDA* - Esta ayuda\n\nTambien puedes responder con numeros del menu.',
    languageChanged: 'Idioma cambiado a English. Type MENU to see options.',
    errorGeneric: 'Hubo un error procesando tu solicitud. Por favor intenta de nuevo.',
    sessionExpired: 'Tu sesion expiro. Escribe MENU para comenzar de nuevo.',
    invalidOption: 'Opcion no valida. Escribe MENU para ver las opciones disponibles.',
  },
  en: {
    welcome: 'Hello {name}! Welcome to the ZBS assistant. I am your tenant portal via WhatsApp.',
    notRegistered: 'Sorry, we could not find your tenant account. Please verify that your phone number is registered with your landlord. If you believe this is an error, contact your property manager.',
    menuBody: 'Select an option from the menu:',
    menuFooter: 'Reply with the number or type the command.',
    optBalance: 'View balance & next payment',
    optPay: 'Pay rent',
    optMaintenance: 'Report maintenance',
    optRequests: 'View my requests',
    optInfo: 'My lease info',
    optContact: 'Contact manager',
    optHelp: 'Help',
    optLanguage: 'Cambiar a Espanol',
    balanceTitle: 'Your account summary',
    noBalance: 'You have no pending payments. All up to date!',
    upcomingPayment: 'Next payment:',
    dueDate: 'Due date:',
    amount: 'Amount:',
    status: 'Status:',
    totalPaid: 'Total paid:',
    totalPending: 'Total pending:',
    payInitiated: 'I am sending you the payment link. You have 30 minutes to complete it.',
    payError: 'There was an error generating the payment link. Please try again later or contact your property manager.',
    noPendingPayments: 'You have no pending payments. All up to date!',
    mantCategory: 'Select the problem category:',
    mantCategories: 'Categories',
    mantGeneral: 'General',
    mantPlumbing: 'Plumbing',
    mantElectrical: 'Electrical',
    mantStructural: 'Structural',
    mantHVAC: 'HVAC / Air Conditioning',
    mantTitle: 'What is the title or short description of the problem?',
    mantDesc: 'Describe the problem in detail (location, when it started, severity):',
    mantPriority: 'Select the priority:',
    mantLow: 'Low - Not urgent',
    mantMedium: 'Medium - Needs attention soon',
    mantHigh: 'High - Needs quick attention',
    mantUrgent: 'Urgent - Emergency',
    mantConfirm: 'Confirm maintenance request?',
    mantConfirmYes: 'Yes, send it',
    mantConfirmNo: 'Cancel',
    mantSubmitted: 'Your maintenance request has been submitted successfully. Reference number: {id}',
    requestsTitle: 'Your maintenance requests',
    noRequests: 'You have no active maintenance requests.',
    infoTitle: 'Your lease information',
    leaseStart: 'Lease start:',
    leaseEnd: 'Lease end:',
    monthlyRent: 'Monthly rent:',
    property: 'Property:',
    unit: 'Unit:',
    contactTitle: 'Manager contact',
    helpText: 'You can interact with me using these commands:\n\n*MENU* - Show main menu\n*BALANCE* - View your balance\n*PAY* - Request payment link\n*MAINTENANCE* - Report a problem\n*MY REQUESTS* - View requests\n*INFO* - Lease info\n*CONTACT* - Contact manager\n*HELP* - This help\n\nYou can also reply with menu numbers.',
    languageChanged: 'Idioma cambiado a Espanol. Escribe MENU para ver opciones.',
    errorGeneric: 'There was an error processing your request. Please try again.',
    sessionExpired: 'Your session has expired. Type MENU to start over.',
    invalidOption: 'Invalid option. Type MENU to see available options.',
  },
};

function t(key: string, lang: 'es' | 'en'): string {
  return STRINGS[lang]?.[key] || STRINGS.es[key] || key;
}

function formatCurrency(amount: number, currency: string = 'TTD'): string {
  return `${currency} ${amount.toLocaleString('en-TT', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string, lang: 'es' | 'en'): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'es' ? 'es-TT' : 'en-TT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Renter Phone Lookup ───

/**
 * Find a renter by their WhatsApp phone number.
 * Matches against Renter.phone (with and without country code, + prefix).
 */
async function findRenterByPhone(phone: string): Promise<{
  renterId: string;
  tenantId: string;
  name: string;
  propertyId: string;
  unitId: string;
  leaseId: string;
  propertyAddress: string;
  unitNumber: string;
  monthlyRent: number;
  leaseStart: string;
  leaseEnd: string;
  currency: string;
  language: string;
} | null> {
  // Normalize phone for matching
  const normalizedPhones = [
    phone,
    phone.replace(/^\+/, ''),
    phone.replace(/^00/, ''),
    phone.replace(/\D/g, ''),
  ];

  // Remove duplicates
  const uniquePhones = [...new Set(normalizedPhones)];

  for (const p of uniquePhones) {
    const renter = await pgQueryOne<any>(`
      SELECT
        r.id AS "renterId",
        r."tenantId",
        COALESCE(r."firstName", '') || ' ' || COALESCE(r."lastName", '') AS name,
        r."propertyId",
        r."unitId",
        r."leaseId",
        p."address" AS "propertyAddress",
        u."unitNumber",
        l."monthlyRent",
        l."startDate" AS "leaseStart",
        l."endDate" AS "leaseEnd",
        l."currency",
        r."language"
      FROM "Renter" r
      LEFT JOIN "Property" p ON p.id = r."propertyId"
      LEFT JOIN "Unit" u ON u.id = r."unitId"
      LEFT JOIN "Lease" l ON l.id = r."leaseId"
      WHERE r."phone" LIKE $1
        AND r.status = 'active'
      LIMIT 1
    `, [`%${p.slice(-10)}%`]); // Match last 10 digits

    if (renter) return renter;
  }

  return null;
}

// ─── Session Management ───

function getSession(phone: string) {
  const session = activeSessions.get(phone);
  if (!session) return null;
  if (Date.now() - session.lastActivity > SESSION_TTL_MS) {
    activeSessions.delete(phone);
    return null;
  }
  session.lastActivity = Date.now();
  return session;
}

function setSession(phone: string, state: string, data: Record<string, any> = {}) {
  activeSessions.set(phone, { state, data: { ...data }, lastActivity: Date.now() });
}

function clearSession(phone: string) {
  activeSessions.delete(phone);
}

// ─── Command Parser ───

function parseCommand(text: string): { command: string; args: string } {
  const cleaned = text.trim().toUpperCase();

  // Direct commands
  const commands: Record<string, string> = {
    'MENU': 'menu',
    'HOLA': 'menu',
    'INICIO': 'menu',
    'START': 'menu',
    'HI': 'menu',
    'HELLO': 'menu',
    '0': 'menu',
    'SALDO': 'balance',
    'BALANCE': 'balance',
    '1': 'balance',
    'PAGAR': 'pay',
    'PAY': 'pay',
    '2': 'pay',
    'MANTENIMIENTO': 'maintenance_start',
    'MANTO': 'maintenance_start',
    'MAINTENANCE': 'maintenance_start',
    '3': 'maintenance_start',
    'SOLICITUDES': 'requests',
    'MIS SOLICITUDES': 'requests',
    'REQUESTS': 'requests',
    'MY REQUESTS': 'requests',
    '4': 'requests',
    'INFO': 'info',
    'CONTRATO': 'info',
    'LEASE': 'info',
    '5': 'info',
    'CONTACTO': 'contact',
    'CONTACT': 'contact',
    '6': 'contact',
    'AYUDA': 'help',
    'HELP': 'help',
    '7': 'help',
    'IDIOMA': 'language',
    'LANGUAGE': 'language',
    'ENGLISH': 'language',
    'ESPAÑOL': 'language',
    'ESPANOL': 'language',
    '8': 'language',
  };

  for (const [key, cmd] of Object.entries(commands)) {
    if (cleaned === key || cleaned.startsWith(key + ' ')) {
      const args = text.trim().slice(key.length).trim();
      return { command: cmd, args };
    }
  }

  return { command: 'unknown', args: text.trim() };
}

// ─── Bot Command Handlers ───

async function handleMenu(ctx: BotContext): Promise<void> {
  clearSession(ctx.whatsappPhone);

  const result = await sendListMessage(ctx.config, ctx.whatsappPhone, {
    header: 'ZBS',
    body: t('menuBody', ctx.language),
    footer: t('menuFooter', ctx.language),
    buttonText: t('menuBody', ctx.language).split(' ').slice(0, 2).join(' '),
    sections: [
      {
        title: ctx.language === 'es' ? 'Mi Cuenta' : 'My Account',
        rows: [
          { id: 'balance', title: `1. ${t('optBalance', ctx.language)}` },
          { id: 'pay', title: `2. ${t('optPay', ctx.language)}` },
        ],
      },
      {
        title: ctx.language === 'es' ? 'Servicios' : 'Services',
        rows: [
          { id: 'maintenance_start', title: `3. ${t('optMaintenance', ctx.language)}` },
          { id: 'requests', title: `4. ${t('optRequests', ctx.language)}` },
        ],
      },
      {
        title: ctx.language === 'es' ? 'Informacion' : 'Information',
        rows: [
          { id: 'info', title: `5. ${t('optInfo', ctx.language)}` },
          { id: 'contact', title: `6. ${t('optContact', ctx.language)}` },
          { id: 'help', title: `7. ${t('optHelp', ctx.language)}` },
          { id: 'language', title: `8. ${t('optLanguage', ctx.language)}` },
        ],
      },
    ],
  });

  await logSentMessage({
    tenantId: ctx.tenantId,
    to: ctx.whatsappPhone,
    body: t('menuBody', ctx.language),
    waMessageId: result.messageId,
    status: result.success ? 'sent' : 'failed',
    errorMessage: result.error,
  });
}

async function handleBalance(ctx: BotContext): Promise<void> {
  clearSession(ctx.whatsappPhone);

  try {
    const payments = await pgQuery<any>(`
      SELECT * FROM "RentPayment"
      WHERE "tenantId" = $1 AND "renterId" = $2
      ORDER BY "dueDate" ASC
      LIMIT 20
    `, [ctx.tenantId, ctx.renterId]);

    const pending = payments.filter((p: any) => ['pending', 'partial', 'overdue'].includes(p.status));
    const paid = payments.filter((p: any) => ['paid', 'completed'].includes(p.status));
    const totalPaid = paid.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
    const totalPending = pending.reduce((sum: number, p: any) => sum + ((parseFloat(p.amount) || 0) - (parseFloat(p.amountPaid) || 0)), 0);

    let message = `*${t('balanceTitle', ctx.language)}*\n\n`;

    if (pending.length > 0) {
      const nextPayment = pending[0];
      message += `*${t('upcomingPayment', ctx.language)}*\n`;
      message += `${t('amount', ctx.language)} ${formatCurrency(parseFloat(nextPayment.amount) || 0, nextPayment.currency || ctx.propertyAddress ? 'TTD' : 'TTD')}\n`;
      message += `${t('dueDate', ctx.language)} ${formatDate(nextPayment.dueDate, ctx.language)}\n`;
      message += `${t('status', ctx.language)} ${formatStatus(nextPayment.status, ctx.language)}\n\n`;

      if (pending.length > 1) {
        message += ctx.language === 'es'
          ? `Tienes ${pending.length} pagos pendientes en total.\n`
          : `You have ${pending.length} pending payments total.\n`;
      }
    } else {
      message += `${t('noBalance', ctx.language)}\n\n`;
    }

    message += `*${t('totalPaid', ctx.language)}* ${formatCurrency(totalPaid)}\n`;
    message += `*${t('totalPending', ctx.language)}* ${formatCurrency(totalPending)}\n`;

    const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, message);
    await logSentMessage({
      tenantId: ctx.tenantId,
      to: ctx.whatsappPhone,
      body: message,
      waMessageId: result.messageId,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error,
    });
  } catch (error: any) {
    console.error('[WhatsApp Bot] handleBalance error:', error);
    await sendErrorReply(ctx);
  }
}

async function handlePay(ctx: BotContext): Promise<void> {
  clearSession(ctx.whatsappPhone);

  try {
    // Find next pending payment
    const pendingPayment = await pgQueryOne<any>(`
      SELECT * FROM "RentPayment"
      WHERE "tenantId" = $1 AND "renterId" = $2
        AND status IN ('pending', 'partial', 'overdue')
      ORDER BY "dueDate" ASC
      LIMIT 1
    `, [ctx.tenantId, ctx.renterId]);

    if (!pendingPayment) {
      const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, t('noPendingPayments', ctx.language));
      await logSentMessage({
        tenantId: ctx.tenantId, to: ctx.whatsappPhone,
        body: t('noPendingPayments', ctx.language),
        waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
      });
      return;
    }

    const balanceDue = (parseFloat(pendingPayment.amount) || 0) - (parseFloat(pendingPayment.amountPaid) || 0);
    const currency = pendingPayment.currency || 'TTD';

    // Generate WiPay payment link
    const { getWiPay } = await import('./wipay');
    const wipay = getWiPay();

    if (!wipay.isConfigured()) {
      // WiPay not configured - send manual payment instructions
      const msg = ctx.language === 'es'
        ? `Tu proximo pago:\n\n*Monto:* ${formatCurrency(balanceDue, currency)}\n*Fecha limite:* ${formatDate(pendingPayment.dueDate, ctx.language)}\n\nEl pago online no esta disponible todavia. Por favor realiza tu pago directamente con el administrador de la propiedad.`
        : `Your next payment:\n\n*Amount:* ${formatCurrency(balanceDue, currency)}\n*Due date:* ${formatDate(pendingPayment.dueDate, ctx.language)}\n\nOnline payment is not available yet. Please make your payment directly with the property manager.`;

      const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, msg);
      await logSentMessage({
        tenantId: ctx.tenantId, to: ctx.whatsappPhone, body: msg,
        waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
      });
      return;
    }

    // Create WiPay order
    const renter = await pgQueryOne<any>(
      `SELECT "firstName", "lastName", "email", "phone" FROM "Renter" WHERE id = $1`,
      [ctx.renterId]
    );

    const customerName = renter
      ? `${renter.firstName || ''} ${renter.lastName || ''}`.trim()
      : 'Tenant';

    const orderResult = await wipay.createOrder({
      total: balanceDue,
      currency: currency,
      description: `Rent Payment - ${pendingPayment.period || formatDate(pendingPayment.dueDate, ctx.language)}`,
      orderId: pendingPayment.id,
      customerName,
      customerEmail: renter?.email || '',
      customerPhone: renter?.phone || '',
      expiry: 1800, // 30 minutes
    });

    if (orderResult.success && orderResult.paymentUrl) {
      // Create WiPayTransaction record
      await pgQuery(`
        INSERT INTO "WiPayTransaction" ("id", "tenantId", "renterId", "rentPaymentId", "amount", "currency", "status", "paymentUrl", "wipayTransactionId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT ("id") DO NOTHING
      `, [
        crypto.randomUUID(),
        ctx.tenantId,
        ctx.renterId,
        pendingPayment.id,
        String(balanceDue),
        currency,
        'initiated',
        orderResult.paymentUrl,
        orderResult.transactionId || '',
        new Date().toISOString(),
        new Date().toISOString(),
      ]);

      const msg = `${t('payInitiated', ctx.language)}\n\n*${formatCurrency(balanceDue, currency)}*\n${orderResult.paymentUrl}`;
      const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, msg, true);
      await logSentMessage({
        tenantId: ctx.tenantId, to: ctx.whatsappPhone, body: msg,
        waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
      });
    } else {
      const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, t('payError', ctx.language));
      await logSentMessage({
        tenantId: ctx.tenantId, to: ctx.whatsappPhone, body: t('payError', ctx.language),
        waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
      });
    }
  } catch (error: any) {
    console.error('[WhatsApp Bot] handlePay error:', error);
    await sendErrorReply(ctx);
  }
}

async function handleMaintenanceStart(ctx: BotContext): Promise<void> {
  setSession(ctx.whatsappPhone, 'maintenance_category');

  const categories = [
    { id: 'general', title: t('mantGeneral', ctx.language) },
    { id: 'plumbing', title: t('mantPlumbing', ctx.language) },
    { id: 'electrical', title: t('mantElectrical', ctx.language) },
    { id: 'structural', title: t('mantStructural', ctx.language) },
    { id: 'hvac', title: t('mantHVAC', ctx.language) },
  ];

  const buttons: { id: string; title: string }[] = categories.map(c => ({
    id: `mant_${c.id}`,
    title: c.title,
  }));

  // WhatsApp allows max 3 buttons per message, so send as list for 5 categories
  const result = await sendListMessage(ctx.config, ctx.whatsappPhone, {
    body: t('mantCategory', ctx.language),
    buttonText: t('mantCategories', ctx.language),
    sections: [{
      title: t('mantCategories', ctx.language),
      rows: categories,
    }],
  });

  await logSentMessage({
    tenantId: ctx.tenantId, to: ctx.whatsappPhone,
    body: t('mantCategory', ctx.language),
    waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
  });
}

async function handleMaintenanceFlow(ctx: BotContext, text: string): Promise<void> {
  const session = getSession(ctx.whatsappPhone);
  if (!session) {
    await handleMaintenanceStart(ctx);
    return;
  }

  switch (session.state) {
    case 'maintenance_category': {
      // Parse category from user response
      const categoryMap: Record<string, string> = {
        'general': 'general', '1': 'general',
        'plumbing': 'plumbing', 'plomeria': 'plumbing', '2': 'plumbing',
        'electrical': 'electrical', 'electrico': 'electrical', '3': 'electrical',
        'structural': 'structural', 'estructural': 'structural', '4': 'structural',
        'hvac': 'hvac', 'aire': 'hvac', 'ac': 'hvac', '5': 'hvac',
      };
      const cleaned = text.toLowerCase().trim();
      const category = categoryMap[cleaned];
      if (!category) {
        await sendTextMessage(ctx.config, ctx.whatsappPhone, t('invalidOption', ctx.language));
        await handleMaintenanceStart(ctx);
        return;
      }
      setSession(ctx.whatsappPhone, 'maintenance_title', { ...session.data, category });
      await sendTextMessage(ctx.config, ctx.whatsappPhone, t('mantTitle', ctx.language));
      break;
    }

    case 'maintenance_title': {
      if (text.trim().length < 3) {
        await sendTextMessage(ctx.config, ctx.whatsappPhone,
          ctx.language === 'es' ? 'Por favor ingresa un titulo mas descriptivo.' : 'Please enter a more descriptive title.');
        return;
      }
      setSession(ctx.whatsappPhone, 'maintenance_description', { ...session.data, title: text.trim() });
      await sendTextMessage(ctx.config, ctx.whatsappPhone, t('mantDesc', ctx.language));
      break;
    }

    case 'maintenance_description': {
      setSession(ctx.whatsappPhone, 'maintenance_priority', { ...session.data, description: text.trim() });

      const result = await sendListMessage(ctx.config, ctx.whatsappPhone, {
        body: t('mantPriority', ctx.language),
        buttonText: t('mantPriority', ctx.language),
        sections: [{
          title: t('mantPriority', ctx.language),
          rows: [
            { id: 'low', title: t('mantLow', ctx.language) },
            { id: 'medium', title: t('mantMedium', ctx.language) },
            { id: 'high', title: t('mantHigh', ctx.language) },
            { id: 'urgent', title: t('mantUrgent', ctx.language) },
          ],
        }],
      });
      await logSentMessage({
        tenantId: ctx.tenantId, to: ctx.whatsappPhone,
        body: t('mantPriority', ctx.language),
        waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
      });
      break;
    }

    case 'maintenance_priority': {
      const priorityMap: Record<string, string> = {
        'low': 'low', 'baja': 'low', '1': 'low',
        'medium': 'medium', 'media': 'medium', '2': 'medium',
        'high': 'high', 'alta': 'high', '3': 'high',
        'urgent': 'urgent', 'urgente': 'urgent', '4': 'urgent',
      };
      const priority = priorityMap[text.toLowerCase().trim()] || 'medium';
      setSession(ctx.whatsappPhone, 'maintenance_confirm', { ...session.data, priority });

      // Show confirmation
      const d = session.data;
      const summary = ctx.language === 'es'
        ? `*Confirmar solicitud de mantenimiento*\n\nTitulo: ${d.title}\nCategoria: ${d.category}\nPrioridad: ${priority}\nDescripcion: ${d.description}\n\nEnvias esta solicitud?`
        : `*Confirm maintenance request*\n\nTitle: ${d.title}\nCategory: ${d.category}\nPriority: ${priority}\nDescription: ${d.description}\n\nSubmit this request?`;

      const result = await sendReplyButtons(ctx.config, ctx.whatsappPhone, {
        body: summary,
        buttons: [
          { id: 'mant_confirm_yes', title: t('mantConfirmYes', ctx.language) },
          { id: 'mant_confirm_no', title: t('mantConfirmNo', ctx.language) },
        ],
      });
      await logSentMessage({
        tenantId: ctx.tenantId, to: ctx.whatsappPhone, body: summary,
        waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
      });
      break;
    }

    case 'maintenance_confirm': {
      if (text.toLowerCase().includes('no') || text.toLowerCase().includes('cancel')) {
        clearSession(ctx.whatsappPhone);
        await handleMenu(ctx);
        return;
      }

      // Create the maintenance request
      const d = session.data;
      try {
        const requestId = crypto.randomUUID();
        await pgQuery(`
          INSERT INTO "MaintenanceRequest" ("id", "tenantId", "propertyId", "unitId", "renterId", "title", "description", "category", "priority", "status", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          requestId,
          ctx.tenantId,
          ctx.propertyId,
          '', // unitId
          ctx.renterId,
          d.title,
          d.description || '',
          d.category || 'general',
          d.priority || 'medium',
          'open',
          new Date().toISOString(),
          new Date().toISOString(),
        ]);

        const msg = t('mantSubmitted', ctx.language).replace('{id}', requestId.slice(0, 8).toUpperCase());
        const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, msg);
        await logSentMessage({
          tenantId: ctx.tenantId, to: ctx.whatsappPhone, body: msg,
          waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
        });

        // Also create a notification for the landlord
        await pgQuery(`
          INSERT INTO "Notification" ("id", "tenantId", "userId", "type", "title", "message", "read", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          crypto.randomUUID(),
          ctx.tenantId,
          null, // Will be picked up by all landlord users
          'maintenance',
          ctx.language === 'es' ? 'Nueva solicitud de mantenimiento' : 'New maintenance request',
          `${d.title} - ${d.category} (${d.priority})`,
          false,
          new Date().toISOString(),
        ]);

        clearSession(ctx.whatsappPhone);
      } catch (error: any) {
        console.error('[WhatsApp Bot] Create maintenance request error:', error);
        await sendErrorReply(ctx);
      }
      break;
    }

    default:
      clearSession(ctx.whatsappPhone);
      await handleMaintenanceStart(ctx);
  }
}

async function handleRequests(ctx: BotContext): Promise<void> {
  clearSession(ctx.whatsappPhone);

  try {
    const requests = await pgQuery<any>(`
      SELECT * FROM "MaintenanceRequest"
      WHERE "tenantId" = $1 AND "renterId" = $2
      ORDER BY "createdAt" DESC
      LIMIT 10
    `, [ctx.tenantId, ctx.renterId]);

    if (requests.length === 0) {
      const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, t('noRequests', ctx.language));
      await logSentMessage({
        tenantId: ctx.tenantId, to: ctx.whatsappPhone,
        body: t('noRequests', ctx.language),
        waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
      });
      return;
    }

    let message = `*${t('requestsTitle', ctx.language)}*\n\n`;

    for (let i = 0; i < requests.length; i++) {
      const r = requests[i];
      message += `*${i + 1}. ${r.title}*\n`;
      message += `${formatStatus(r.status, ctx.language)} - ${r.category || 'general'} - ${r.priority || 'medium'}\n`;
      message += `${formatDate(r.createdAt, ctx.language)}\n\n`;
    }

    const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, message);
    await logSentMessage({
      tenantId: ctx.tenantId, to: ctx.whatsappPhone, body: message,
      waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
    });
  } catch (error: any) {
    console.error('[WhatsApp Bot] handleRequests error:', error);
    await sendErrorReply(ctx);
  }
}

async function handleInfo(ctx: BotContext): Promise<void> {
  clearSession(ctx.whatsappPhone);

  try {
    const renter = await pgQueryOne<any>(`
      SELECT r.*, l."monthlyRent", l."startDate", l."endDate", l."currency",
             p."name" as "propertyName", p."address" as "propertyAddress",
             u."unitNumber"
      FROM "Renter" r
      LEFT JOIN "Lease" l ON l.id = r."leaseId"
      LEFT JOIN "Property" p ON p.id = r."propertyId"
      LEFT JOIN "Unit" u ON u.id = r."unitId"
      WHERE r.id = $1
    `, [ctx.renterId]);

    if (!renter) {
      await sendErrorReply(ctx);
      return;
    }

    const currency = renter.currency || 'TTD';
    let message = `*${t('infoTitle', ctx.language)}*\n\n`;
    message += `*${t('property', ctx.language)}* ${renter.propertyName || renter.propertyAddress || 'N/A'}\n`;
    message += `*${t('unit', ctx.language)}* ${renter.unitNumber || 'N/A'}\n`;
    message += `*${t('monthlyRent', ctx.language)}* ${formatCurrency(parseFloat(renter.monthlyRent) || 0, currency)}\n`;
    message += `*${t('leaseStart', ctx.language)}* ${formatDate(renter.startDate, ctx.language)}\n`;
    message += `*${t('leaseEnd', ctx.language)}* ${formatDate(renter.endDate, ctx.language)}\n`;

    const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, message);
    await logSentMessage({
      tenantId: ctx.tenantId, to: ctx.whatsappPhone, body: message,
      waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
    });
  } catch (error: any) {
    console.error('[WhatsApp Bot] handleInfo error:', error);
    await sendErrorReply(ctx);
  }
}

async function handleContact(ctx: BotContext): Promise<void> {
  clearSession(ctx.whatsappPhone);

  try {
    // Get tenant/landlord contact info
    const tenant = await pgQueryOne<any>(
      `SELECT "name", "email", "phone", "website" FROM "Tenant" WHERE id = $1`,
      [ctx.tenantId]
    );

    if (!tenant) {
      await sendErrorReply(ctx);
      return;
    }

    let message = `*${t('contactTitle', ctx.language)}*\n\n`;
    message += `*${tenant.name}*\n`;
    if (tenant.phone) message += `${ctx.language === 'es' ? 'Telefono' : 'Phone'}: ${tenant.phone}\n`;
    if (tenant.email) message += `Email: ${tenant.email}\n`;
    if (tenant.website) message += `Web: ${tenant.website}\n`;

    const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, message);
    await logSentMessage({
      tenantId: ctx.tenantId, to: ctx.whatsappPhone, body: message,
      waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
    });
  } catch (error: any) {
    console.error('[WhatsApp Bot] handleContact error:', error);
    await sendErrorReply(ctx);
  }
}

async function handleHelp(ctx: BotContext): Promise<void> {
  clearSession(ctx.whatsappPhone);

  const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, t('helpText', ctx.language));
  await logSentMessage({
    tenantId: ctx.tenantId, to: ctx.whatsappPhone, body: t('helpText', ctx.language),
    waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
  });
}

async function handleLanguage(ctx: BotContext): Promise<void> {
  clearSession(ctx.whatsappPhone);

  const newLang = ctx.language === 'es' ? 'en' : 'es';

  // Update renter language in database
  try {
    await pgQuery(
      `UPDATE "Renter" SET "language" = $1, "updatedAt" = $2 WHERE id = $3`,
      [newLang, new Date().toISOString(), ctx.renterId]
    );
  } catch {
    // Non-critical
  }

  const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, t('languageChanged', newLang));
  await logSentMessage({
    tenantId: ctx.tenantId, to: ctx.whatsappPhone,
    body: t('languageChanged', newLang),
    waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
  });
}

// ─── Status Formatting ───

function formatStatus(status: string, lang: 'es' | 'en'): string {
  const map: Record<string, Record<string, string>> = {
    paid: { es: 'Pagado', en: 'Paid' },
    completed: { es: 'Completado', en: 'Completed' },
    pending: { es: 'Pendiente', en: 'Pending' },
    partial: { es: 'Parcial', en: 'Partial' },
    overdue: { es: 'Atrasado', en: 'Overdue' },
    expired: { es: 'Vencido', en: 'Expired' },
    open: { es: 'Abierta', en: 'Open' },
    'in_progress': { es: 'En Progreso', en: 'In Progress' },
    resolved: { es: 'Resuelta', en: 'Resolved' },
    closed: { es: 'Cerrada', en: 'Closed' },
    initiated: { es: 'Iniciado', en: 'Initiated' },
  };
  return map[status]?.[lang] || status;
}

async function sendErrorReply(ctx: BotContext): Promise<void> {
  const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, t('errorGeneric', ctx.language));
  await logSentMessage({
    tenantId: ctx.tenantId, to: ctx.whatsappPhone,
    body: t('errorGeneric', ctx.language),
    waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
  });
}

// ─── Main Entry Point ───

/**
 * Process an incoming WhatsApp message and respond as the ZBS bot.
 *
 * This is called from the webhook handler after storing the incoming message.
 *
 * @param from - Sender's WhatsApp phone number
 * @param text - Message text content
 * @param tenantId - Resolved tenant ID
 * @param phoneNumberId - WhatsApp phone number ID (for config lookup)
 */
export async function processBotMessage(
  from: string,
  text: string,
  tenantId: string,
  phoneNumberId: string
): Promise<void> {
  try {
    // 1. Find renter by phone number
    const renter = await findRenterByPhone(from);
    if (!renter) {
      const config = await getWhatsAppConfig(tenantId);
      if (!config) {
        console.warn('[WhatsApp Bot] No WhatsApp config for tenant:', tenantId);
        return;
      }
      const result = await sendTextMessage(config, from, t('notRegistered', 'es'));
      await logSentMessage({
        tenantId, to: from, body: t('notRegistered', 'es'),
        waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
      });
      return;
    }

    // 2. Get WhatsApp config
    const config = await getWhatsAppConfig(renter.tenantId);
    if (!config) {
      console.warn('[WhatsApp Bot] No WhatsApp config for tenant:', renter.tenantId);
      return;
    }

    // 3. Build bot context
    const ctx: BotContext = {
      tenantId: renter.tenantId,
      renterId: renter.renterId,
      renterName: renter.name.trim(),
      whatsappPhone: from,
      config,
      language: (renter.language === 'en' ? 'en' : 'es') as 'es' | 'en',
      propertyId: renter.propertyId || '',
      propertyAddress: renter.propertyAddress || '',
      unitNumber: renter.unitNumber || '',
    };

    // 4. Parse command
    const { command, args } = parseCommand(text);

    // 5. Handle interactive list/button replies (Meta sends them as specific formats)
    // Interactive list replies come as: {"type": "interactive", "interactive": {"type": "list_reply", "list_reply": {"id": "balance", ...}}}
    // These are pre-parsed by the webhook into text. Check for list_reply ID format.

    // 6. Check for active maintenance flow session
    const session = getSession(from);
    if (session && session.state.startsWith('maintenance_')) {
      await handleMaintenanceFlow(ctx, text);
      return;
    }

    // 7. Route to command handler
    switch (command) {
      case 'menu':
        await handleMenu(ctx);
        break;
      case 'balance':
        await handleBalance(ctx);
        break;
      case 'pay':
        await handlePay(ctx);
        break;
      case 'maintenance_start':
        await handleMaintenanceStart(ctx);
        break;
      case 'requests':
        await handleRequests(ctx);
        break;
      case 'info':
        await handleInfo(ctx);
        break;
      case 'contact':
        await handleContact(ctx);
        break;
      case 'help':
        await handleHelp(ctx);
        break;
      case 'language':
        await handleLanguage(ctx);
        break;
      case 'unknown':
      default:
        // First-time user or unrecognized command - show welcome + menu
        if (!session) {
          const welcome = t('welcome', ctx.language).replace('{name}', ctx.renterName.split(' ')[0]);
          await sendTextMessage(ctx.config, ctx.whatsappPhone, welcome);
          await handleMenu(ctx);
        } else {
          const result = await sendTextMessage(ctx.config, ctx.whatsappPhone, t('invalidOption', ctx.language));
          await logSentMessage({
            tenantId: ctx.tenantId, to: ctx.whatsappPhone,
            body: t('invalidOption', ctx.language),
            waMessageId: result.messageId, status: result.success ? 'sent' : 'failed',
          });
        }
        break;
    }
  } catch (error: any) {
    console.error('[WhatsApp Bot] processBotMessage unhandled error:', error);
  }
}
