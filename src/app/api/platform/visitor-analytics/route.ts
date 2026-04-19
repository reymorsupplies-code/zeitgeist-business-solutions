import { NextRequest, NextResponse } from 'next/server';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// Track a page visit
export async function POST(req: NextRequest) {
  try {
    const { page, referrer, userAgent } = await req.json();
    
    const country = req.headers.get('x-vercel-ip-country') || 
                   req.headers.get('x-country-code') || 
                   req.headers.get('cf-ipcountry') || 'Unknown';
    
    const city = req.headers.get('x-vercel-ip-city') || 'Unknown';
    const region = req.headers.get('x-vercel-ip-country-region') || 'Unknown';
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'Unknown';
    
    const meta = JSON.stringify({ country, city, region, ip, userAgent: (userAgent || '').substring(0, 200), timestamp: new Date().toISOString() }).replace(/'/g, "''");
    const safePage = (page || 'unknown').replace(/'/g, "''");
    const safeRef = (referrer || 'direct').replace(/'/g, "''");
    
    await pgQuery(
      `INSERT INTO "SystemEvent" (type, title, description, severity, metadata) VALUES ('page_visit', '${safePage}', '${safeRef}', 'info', '${meta}')`
    );
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Get analytics data
export async function GET() {
  try {
    // Since metadata is TEXT, we parse it in application code
    // First get all page_visit events
    const events = await pgQuery<any>(
      `SELECT title, description, metadata, "createdAt" FROM "SystemEvent" WHERE type = 'page_visit' ORDER BY "createdAt" DESC LIMIT 5000`
    );
    
    // Process in JS
    const countryMap: Record<string, { visits: number; uniqueIps: Set<string> }> = {};
    const pageMap: Record<string, number> = {};
    const dailyMap: Record<string, { visits: number; uniqueIps: Set<string> }> = {};
    const referrerMap: Record<string, number> = {};
    const countryPageMap: Record<string, Record<string, number>> = {};
    const allIps = new Set<string>();
    let firstVisit: string | null = null;
    let lastVisit: string | null = null;
    
    for (const ev of events) {
      let meta: any = {};
      try { meta = JSON.parse(ev.metadata || '{}'); } catch {}
      
      const country = meta.country || 'Unknown';
      const ip = meta.ip || 'unknown';
      const date = ev.createdAt?.substring(0, 10) || 'unknown';
      const pageTitle = ev.title || 'unknown';
      const ref = ev.description || 'direct';
      
      allIps.add(ip);
      if (!firstVisit || ev.createdAt < firstVisit) firstVisit = ev.createdAt;
      if (!lastVisit || ev.createdAt > lastVisit) lastVisit = ev.createdAt;
      
      // Country stats
      if (!countryMap[country]) countryMap[country] = { visits: 0, uniqueIps: new Set() };
      countryMap[country].visits++;
      countryMap[country].uniqueIps.add(ip);
      
      // Page stats
      pageMap[pageTitle] = (pageMap[pageTitle] || 0) + 1;
      
      // Daily stats
      if (!dailyMap[date]) dailyMap[date] = { visits: 0, uniqueIps: new Set() };
      dailyMap[date].visits++;
      dailyMap[date].uniqueIps.add(ip);
      
      // Referrer stats
      if (ref !== 'direct') {
        referrerMap[ref] = (referrerMap[ref] || 0) + 1;
      }
      
      // Country x Page
      if (country !== 'Unknown') {
        if (!countryPageMap[country]) countryPageMap[country] = {};
        countryPageMap[country][pageTitle] = (countryPageMap[country][pageTitle] || 0) + 1;
      }
    }
    
    const totalVisits = events.length;
    const uniqueVisitors = allIps.size;
    
    // Sort and format
    const byCountry = Object.entries(countryMap)
      .filter(([c]) => c !== 'Unknown')
      .map(([country, data]) => ({ country, visits: data.visits, uniqueVisitors: data.uniqueIps.size }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 20);
    
    const byPage = Object.entries(pageMap)
      .map(([page, visits]) => ({ page, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 15);
    
    const daily = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, visits: data.visits, uniqueVisitors: data.uniqueIps.size }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
    
    const referrers = Object.entries(referrerMap)
      .map(([referrer, visits]) => ({ referrer, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
    
    const countryPages = Object.entries(countryPageMap)
      .flatMap(([country, pages]) => 
        Object.entries(pages).map(([page, visits]) => ({ country, page, visits }))
      )
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 50);
    
    return NextResponse.json({
      total: { total_visits: totalVisits, unique_visitors: uniqueVisitors, first_visit: firstVisit, last_visit: lastVisit },
      byCountry,
      byPage,
      daily,
      referrers,
      countryPages,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
