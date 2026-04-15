import { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area 
} from 'recharts';
import { 
  FiFilter, FiDownload, FiRefreshCw, FiTrendingUp, FiShoppingBag, 
  FiDollarSign, FiStar, FiCalendar, FiSearch, FiChevronLeft, FiChevronRight 
} from 'react-icons/fi';
import { exportToExcel } from '../../utils/excelExport';

export default function RevenueAnalytics({ payments, courses, users }) {
  // Filters State
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [courseFilter, setCourseFilter] = useState('all');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('completed'); // Default to completed
  const [methodFilter, setMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewType, setViewType] = useState('combined'); // 'revenue', 'orders', 'combined'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Quick Filters Logic
  const setQuickFilter = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setDateRange({
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0]
    });
  };

  const resetFilters = () => {
    setDateRange({ from: '', to: '' });
    setCourseFilter('all');
    setUserTypeFilter('all');
    setStatusFilter('completed');
    setMethodFilter('all');
    setSearchQuery('');
  };

  // Filtered Data Logic
  const filteredData = useMemo(() => {
    return payments.filter(p => {
      const pDate = new Date(p.created_at);
      const matchesDate = (!dateRange.from || pDate >= new Date(dateRange.from)) && 
                          (!dateRange.to || pDate <= new Date(dateRange.to + 'T23:59:59'));
      const matchesCourse = courseFilter === 'all' || p.course_id === courseFilter;
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      // Note: method and transaction_id might be missing in DB, fallback to 'UPI' for demo if null
      const matchesMethod = methodFilter === 'all' || (p.payment_method || 'UPI') === methodFilter;
      
      const user = users.find(u => u.id === p.user_id);
      const isNewUser = user && new Date(user.created_at) >= new Date(new Date().setDate(new Date().getDate() - 30));
      const matchesUserType = userTypeFilter === 'all' || 
                              (userTypeFilter === 'new' && isNewUser) || 
                              (userTypeFilter === 'returning' && !isNewUser);

      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
                           (p.user?.name || '').toLowerCase().includes(q) || 
                           (p.item_title || p.course?.title || '').toLowerCase().includes(q) || 
                           (p.id || '').toLowerCase().includes(q);

      return matchesDate && matchesCourse && matchesStatus && matchesMethod && matchesUserType && matchesSearch;
    });
  }, [payments, dateRange, courseFilter, statusFilter, methodFilter, userTypeFilter, searchQuery, users]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalRev = filteredData.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalOrders = filteredData.length;
    const aov = totalOrders > 0 ? totalRev / totalOrders : 0;
    
    const courseCounts = filteredData.reduce((acc, p) => {
      const title = p.item_title || p.course?.title || 'Unknown';
      acc[title] = (acc[title] || 0) + 1;
      return acc;
    }, {});
    const topCourse = Object.entries(courseCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return { totalRev, totalOrders, aov, topCourse };
  }, [filteredData]);

  // Chart Data Aggregation
  const chartData = useMemo(() => {
    const daily = filteredData.reduce((acc, p) => {
      const date = new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (!acc[date]) acc[date] = { date, revenue: 0, orders: 0 };
      acc[date].revenue += Number(p.amount) || 0;
      acc[date].orders += 1;
      return acc;
    }, {});
    return Object.values(daily).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-15);
  }, [filteredData]);

  // Pagination Table
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleExport = () => {
    const exportData = filteredData.map((p, index) => ({
      'S.No': index + 1,
      'Date': new Date(p.created_at).toLocaleDateString(),
      'User Name': p.user?.name || 'Unknown',
      'Item Name': p.item_title || p.course?.title || 'Unknown',
      'Amount (₹)': p.amount,
      'Method': p.payment_method || 'UPI',
      'Status': p.status || 'completed',
      'Transaction ID': p.id
    }));
    exportToExcel(exportData, 'Revenue_Report');
  };

  return (
    <div className="revenue-analytics animate-fade">
      {/* Sticky Filter Bar */}
      <div className="analytics-filters-sticky">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Date Range</label>
            <div className="date-inputs">
              <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} />
              <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} />
            </div>
          </div>
          <div className="filter-group">
            <label>Quick Select</label>
            <div className="quick-buttons">
              <button onClick={() => setQuickFilter(0)}>Today</button>
              <button onClick={() => setQuickFilter(7)}>7 Days</button>
              <button onClick={() => setQuickFilter(30)}>Month</button>
            </div>
          </div>
          <div className="filter-group">
            <label>Item / Course</label>
            <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
              <option value="all">All Items</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="completed">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="filter-group action-group">
            <button className="btn-reset" onClick={resetFilters}><FiRefreshCw /> Reset</button>
            <button className="btn-export" onClick={handleExport}><FiDownload /> Export Excel</button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon rev"><FiDollarSign /></div>
          <div className="kpi-info">
            <p>Total Revenue</p>
            <h3>₹{kpis.totalRev.toLocaleString('en-IN')}</h3>
            <span className="trend pos"><FiTrendingUp /> +12% vs last month</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orders"><FiShoppingBag /></div>
          <div className="kpi-info">
            <p>Total Orders</p>
            <h3>{kpis.totalOrders}</h3>
            <span>Successful transactions</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon aov"><FiStar /></div>
          <div className="kpi-info">
            <p>Average Order Value</p>
            <h3>₹{Math.round(kpis.aov).toLocaleString('en-IN')}</h3>
            <span>Efficiency per user</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon top"><FiTrendingUp /></div>
          <div className="kpi-info">
            <p>Top Course</p>
            <h3 className="truncate">{kpis.topCourse}</h3>
            <span>Highest selling this period</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section card-glass">
        <div className="chart-header">
          <h3>Growth Analytics</h3>
          <div className="chart-toggles">
            <button className={viewType === 'revenue' ? 'active' : ''} onClick={() => setViewType('revenue')}>Revenue</button>
            <button className={viewType === 'orders' ? 'active' : ''} onClick={() => setViewType('orders')}>Orders</button>
            <button className={viewType === 'combined' ? 'active' : ''} onClick={() => setViewType('combined')}>Combined</button>
          </div>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={350}>
            {viewType === 'orders' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{background: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff'}} />
                <Line type="monotone" dataKey="orders" stroke="var(--primary)" strokeWidth={3} dot={{r: 4, fill: 'var(--primary)'}} />
              </LineChart>
            ) : viewType === 'revenue' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{background: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff'}} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="orders" stroke="#10b981" fill="transparent" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="transactions-card card-glass">
        <div className="table-header">
          <div className="header-left">
            <h3>Transaction History</h3>
            <p>{filteredData.length} records found</p>
          </div>
          <div className="table-search">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Search by User, Course or ID..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="ap-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>User Details</th>
                <th>Item Purchased</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((p, idx) => (
                <tr key={p.id}>
                  <td>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                  <td>
                    <div className="td-date">
                      <FiCalendar />
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div className="td-user">
                      <strong>{p.user?.name || 'Unknown'}</strong>
                      <small>ID: {p.user_id?.slice(0,8) || '-'}</small>
                    </div>
                  </td>
                  <td>{p.item_title || p.course?.title || 'Unknown'}</td>
                  <td className="fw-bold">₹{p.amount}</td>
                  <td><span className="method-pill">{p.payment_method || 'UPI'}</span></td>
                  <td>
                    <span className={`status-pill ${p.status || 'completed'}`}>
                      {p.status === 'completed' || !p.status ? 'Paid' : p.status}
                    </span>
                  </td>
                  <td><code className="text-muted">{p.id?.slice(0,12) || '-'}...</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="table-pagination">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <FiChevronLeft /> Previous
            </button>
            <div className="page-numbers">
              Page {currentPage} of {totalPages}
            </div>
            <button 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next <FiChevronRight />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
