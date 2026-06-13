import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Stats interface
interface AnalyticsStats {
  totalThisMonth: number;
  interviewRate: number;
  avgResponseDays: number;
  mostActiveCompany: string;
}

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<any[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [stats, setStats] = useState<AnalyticsStats>({
    totalThisMonth: 0,
    interviewRate: 0,
    avgResponseDays: 0,
    mostActiveCompany: 'N/A'
  });

  // Recharts dynamically imported client-side
  const [recharts, setRecharts] = useState<any>(null);

  useEffect(() => {
    // 1. Load Recharts dynamically
    import('recharts').then(mod => {
      setRecharts(mod);
    });

    // 2. Fetch data from Supabase
    fetchAnalyticsData();

    // 3. Listen for dark mode changes
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    window.addEventListener('theme-change', checkDark);
    return () => window.removeEventListener('theme-change', checkDark);
  }, []);

  async function fetchAnalyticsData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;
      const appList = data || [];
      setApps(appList);

      // Calculate aggregated metrics
      calculateStats(appList);
    } catch (err: any) {
      console.error('Error fetching analytics data:', err);
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast(err.message || 'Failed to fetch analytics metrics.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(appList: any[]) {
    const now = new Date();
    
    // 1. Total this calendar month
    const thisMonth = appList.filter(a => {
      const date = new Date(a.applied_date || a.created_at);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;

    // 2. Interview conversion rate: (interview + offer) / total
    const total = appList.length;
    const interviews = appList.filter(a => ['interview', 'offer'].includes(a.status)).length;
    const interviewRate = total > 0 ? Math.round((interviews / total) * 100) : 0;

    // 3. Average days to response
    const responded = appList.filter(a => a.applied_date && a.response_date);
    let avgResponseDays = 0;
    if (responded.length > 0) {
      const totalDays = responded.reduce((acc, a) => {
        const applied = new Date(a.applied_date);
        const resp = new Date(a.response_date);
        const diff = Math.ceil((resp.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
        return acc + (diff > 0 ? diff : 0);
      }, 0);
      avgResponseDays = Math.round(totalDays / responded.length);
    }

    // 4. Most active company
    const companyCounts: Record<string, number> = {};
    appList.forEach(a => {
      companyCounts[a.company_name] = (companyCounts[a.company_name] || 0) + 1;
    });
    const sortedCompanies = Object.entries(companyCounts).sort((a, b) => b[1] - a[1]);
    const mostActiveCompany = sortedCompanies.length > 0 ? sortedCompanies[0][0] : 'N/A';

    setStats({
      totalThisMonth: thisMonth,
      interviewRate,
      avgResponseDays,
      mostActiveCompany
    });
  }

  if (loading || !recharts) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32 space-y-4">
        <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-xs font-semibold text-body-text animate-pulse">Compiling database metrics and charts...</p>
      </div>
    );
  }

  // Destructure Recharts components
  const {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Legend,
    CartesianGrid
  } = recharts;

  // =========================================================================
  // DATA PREPARATION FOR CHARTS
  // =========================================================================

  // Chart 1: Applications over time (Last 30 days)
  const last30DaysData = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = apps.filter(a => {
      const appDate = new Date(a.applied_date || a.created_at);
      return appDate.toDateString() === d.toDateString();
    }).length;
    last30DaysData.push({ date: dateStr, count });
  }

  // Chart 2: Status Breakdown
  const statusColors = {
    Saved: '#888888',
    Applied: '#0070f3',
    Interview: '#7928ca',
    Offer: '#50e3c2',
    Rejected: '#ee0000'
  };
  const statusData = ['saved', 'applied', 'interview', 'offer', 'rejected'].map(status => {
    const count = apps.filter(a => a.status === status).length;
    const name = status.charAt(0).toUpperCase() + status.slice(1);
    const percentage = apps.length > 0 ? Math.round((count / apps.length) * 100) : 0;
    return {
      name,
      value: count,
      percentage,
      color: statusColors[name as keyof typeof statusColors]
    };
  }).filter(item => item.value > 0); // Only show statuses that have values

  // Chart 3: Skills Gap analysis (Top 10 missing)
  const missingSkillsCounts: Record<string, number> = {};
  apps.forEach(a => {
    if (a.ai_missing_skills) {
      a.ai_missing_skills.forEach((skill: string) => {
        const clean = skill.trim();
        if (clean) missingSkillsCounts[clean] = (missingSkillsCounts[clean] || 0) + 1;
      });
    }
  });
  const skillsGapData = Object.entries(missingSkillsCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Chart 4: Weekly Activity
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyActivityData = weekdayNames.map((day, idx) => {
    const count = apps.filter(a => {
      const date = new Date(a.applied_date || a.created_at);
      return date.getDay() === idx;
    }).length;
    return { day, count };
  });

  // Chart 5: Response rate by work type
  const workTypes = ['Remote', 'Hybrid', 'Onsite'];
  const responseByWorkTypeData = workTypes.map(type => {
    const typeApps = apps.filter(a => (a.work_type || '').toLowerCase() === type.toLowerCase());
    const totalType = typeApps.length;
    const responses = typeApps.filter(a => ['interview', 'offer', 'rejected'].includes(a.status) || a.response_date).length;
    const rate = totalType > 0 ? Math.round((responses / totalType) * 100) : 0;
    return { type, rate, count: totalType };
  });

  // Theme-aware chart styling
  const tooltipStyle = {
    backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
    borderColor: isDark ? '#2e2e2e' : '#ebebeb',
    borderRadius: '4px',
    fontFamily: 'var(--font-geist)',
    color: isDark ? '#f5f5f5' : '#171717'
  };
  const gridStroke = isDark ? '#2e2e2e' : '#ebebeb';
  const axisStroke = isDark ? '#737373' : '#888888';
  const labelColor = isDark ? '#f5f5f5' : '#171717';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Search Analytics</h2>
          <p className="text-xs text-body-text mt-1">Aggregated pipeline metrics and analysis.</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-canvas border border-hairline p-5 rounded-md shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-wider text-mute-text">Total This Month</p>
          <p className="text-2xl font-bold mt-1 text-ink">{stats.totalThisMonth}</p>
        </div>
        <div className="bg-canvas border border-hairline p-5 rounded-md shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-wider text-mute-text">Interview Conversion</p>
          <p className="text-2xl font-bold mt-1 text-ink">{stats.interviewRate}%</p>
        </div>
        <div className="bg-canvas border border-hairline p-5 rounded-md shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-wider text-mute-text">Avg Days to Response</p>
          <p className="text-2xl font-bold mt-1 text-ink">{stats.avgResponseDays} days</p>
        </div>
        <div className="bg-canvas border border-hairline p-5 rounded-md shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-wider text-mute-text">Top Active Target</p>
          <p className="text-2xl font-bold mt-1 text-ink truncate" title={stats.mostActiveCompany}>
            {stats.mostActiveCompany}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 1. Applications Over Time (Spans 2 columns) */}
        <div className="bg-canvas border border-hairline p-6 rounded-md shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold tracking-tight text-ink">Applications Over Time</h4>
            <span className="text-[10px] font-mono text-mute-text">Last 30 Days</span>
          </div>
          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last30DaysData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" stroke={axisStroke} tickLine={false} />
                <YAxis stroke={axisStroke} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={tooltipStyle} 
                  labelStyle={{ fontWeight: 'bold', color: labelColor }}
                />
                <Line type="monotone" dataKey="count" name="Applications" stroke="#7928ca" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Status Breakdown (PieChart) */}
        <div className="bg-canvas border border-hairline p-6 rounded-md shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold tracking-tight text-ink">Pipeline Breakdown</h4>
            <span className="text-[10px] font-mono text-mute-text">Total Distribution</span>
          </div>
          <div className="h-72 w-full text-xs flex flex-col sm:flex-row items-center justify-center gap-6">
            {statusData.length === 0 ? (
              <p className="text-xs text-mute-text italic py-20">No applications on board yet.</p>
            ) : (
              <>
                <div className="h-56 w-56 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any, name: any, props: any) => [`${value} (${props.payload.percentage}%)`, name]}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend list */}
                <div className="flex flex-col gap-2.5 w-full">
                  {statusData.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="font-medium text-body-text">{item.name}</span>
                      </div>
                      <span className="font-mono text-mute-text font-semibold">{item.value} ({item.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 3. Skills Gap Analysis (BarChart) */}
        <div className="bg-canvas border border-hairline p-6 rounded-md shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold tracking-tight text-ink">AI Skills Gap Analysis</h4>
            <span className="text-[10px] font-mono text-mute-text">Top 10 Missing Skills</span>
          </div>
          <div className="h-72 w-full text-xs">
            {skillsGapData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-mute-text italic">No AI missing skill details calculated yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillsGapData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" stroke={axisStroke} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke={axisStroke} tickLine={false} width={80} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name="Frequency" fill="#ee0000" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 4. Weekly Activity (BarChart) */}
        <div className="bg-canvas border border-hairline p-6 rounded-md shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold tracking-tight text-ink">Weekly Application Activity</h4>
            <span className="text-[10px] font-mono text-mute-text">By Day of Week</span>
          </div>
          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="day" stroke={axisStroke} tickLine={false} />
                <YAxis stroke={axisStroke} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Applications" fill="#0070f3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Response Rate by Work Type (BarChart) */}
        <div className="bg-canvas border border-hairline p-6 rounded-md shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold tracking-tight text-ink">Response Rate by Work Type</h4>
            <span className="text-[10px] font-mono text-mute-text">Remote vs Hybrid vs Onsite</span>
          </div>
          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseByWorkTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="type" stroke={axisStroke} tickLine={false} />
                <YAxis stroke={axisStroke} tickLine={false} unit="%" />
                <Tooltip 
                  formatter={(value: any, name: any, props: any) => [`${value}% (Total: ${props.payload.count})`, 'Response Rate']}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="rate" name="Response Rate" fill="#50e3c2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
