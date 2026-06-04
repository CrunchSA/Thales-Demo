import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import axios from 'axios';

const API_BASE = '/api';

interface Record {
  id: number;
  name: string;
  email: string;
  credit_card: string;
}

interface RevealedData {
  [key: string]: string;
}

interface ApiLog {
  id: number;
  method: string;
  url: string;
  request: any;
  response?: any;
  error?: any;
  time: string;
}

interface BackendLog {
  id: number;
  message: string;
  details?: any;
  time: string;
}

function App() {
  const [formData, setFormData] = useState({ name: '', email: '', credit_card: '' });
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealedData, setRevealedData] = useState<RevealedData>({});
  const [revealUserName, setRevealUserName] = useState('');
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [backendLogs, setBackendLogs] = useState<BackendLog[]>([]);

  const addApiLog = (log: Omit<ApiLog, 'id' | 'time'>) => {
    setApiLogs(prev => [{ ...log, id: Date.now() + Math.random(), time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const addBackendLog = (log: Omit<BackendLog, 'id' | 'time'>) => {
    setBackendLogs(prev => [{ ...log, id: Date.now() + Math.random(), time: new Date().toLocaleTimeString() }, ...prev]);
  };

  useEffect(() => {
    fetchRecords();
    fetchStartupLogs();
  }, []);

  const fetchStartupLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/startup-logs`);
      const logs = res.data.map((log: any) => ({
        message: log.message,
        details: log.details,
      }));
      logs.forEach((log: Omit<BackendLog, 'id' | 'time'>) => addBackendLog(log));
    } catch (e) {
      console.error("Failed to fetch startup logs", e);
    }
  };

  const fetchRecords = async () => {
    const url = `${API_BASE}/records`;
    try {
      const response = await axios.get(url);
      addApiLog({ method: 'GET', url, request: null, response: response.data });
      setRecords(response.data);
    } catch (err: any) {
      addApiLog({
        method: 'GET',
        url,
        request: null,
        error: {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data
        }
      });
      console.error("Failed to fetch records", err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = `${API_BASE}/protect`;
    try {
      const response = await axios.post(url, formData);
      addApiLog({ method: 'POST', url, request: formData, response: response.data });

      setFormData({ name: '', email: '', credit_card: '' });
      fetchRecords();
    } catch (err: any) {
      addApiLog({
        method: 'POST',
        url,
        request: formData,
        error: {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data
        }
      });
      alert("Error saving record: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = async (id: number, field: string) => {
    const url = `${API_BASE}/reveal`;
    const payload = { id, field, username: revealUserName };
    try {
      const response = await axios.post(url, payload);
      addApiLog({ method: 'POST', url, request: payload, response: response.data });

      setRevealedData(prev => ({
        ...prev,
        [`${id}-${field}`]: response.data.revealed
      }));
    } catch (err: any) {
      addApiLog({
        method: 'POST',
        url,
        request: payload,
        error: {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data
        }
      });
      alert("Reveal failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleClearRecords = async () => {
    const confirmed = window.confirm('Clear all demo records from the database? This cannot be undone.');
    if (!confirmed) return;

    const url = `${API_BASE}/clear-records`;
    try {
      const response = await axios.post(url);
      addApiLog({ method: 'POST', url, request: null, response: response.data });
      fetchRecords();
      setRevealedData({});
      alert(`Cleared ${response.data.deletedRows || 0} record(s).`);
    } catch (err: any) {
      addApiLog({
        method: 'POST',
        url,
        request: null,
        error: {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data
        }
      });
      alert('Failed to clear records: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>, field: string) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const renderLogValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-slate-500">{String(value)}</span>;
    if (typeof value === 'object') {
      return <pre className="whitespace-pre-wrap text-slate-300 bg-slate-800 p-2 rounded-md overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>;
    }
    return <span>{String(value)}</span>;
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#003764] text-white p-6 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Thales CipherTrust Demo</h1>
          <div className="flex gap-4 items-center">
            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-mono">
              CSM: Connected
            </span>
            <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-mono">
              CRDP: Active
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-10 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Input Section */}
        <section className="lg:col-span-1">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold mb-6 text-slate-800">Add Customer Record</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003764] focus:border-transparent outline-none transition"
                  value={formData.name}
                  onChange={(e) => handleInputChange(e, 'name')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Email (PII - Protected)</label>
                <input 
                  type="email" 
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003764] focus:border-transparent outline-none transition"
                  value={formData.email}
                  onChange={(e) => handleInputChange(e, 'email')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Credit Card (Sensitive - Protected)</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003764] focus:border-transparent outline-none transition"
                  value={formData.credit_card}
                  onChange={(e) => handleInputChange(e, 'credit_card')}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#003764] hover:bg-[#002a4d] text-white font-bold py-3 rounded-lg mt-4 transition-colors disabled:opacity-50"
              >
                {loading ? 'Protecting & Saving...' : 'Securely Save to MySQL'}
              </button>
            </form>
          </div>

          <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 className="text-sm font-bold text-blue-800 mb-2 underline">How it works:</h3>
            <p className="text-xs text-blue-700 leading-relaxed">
              Upon clicking "Save", the application sends the Email and Credit Card fields to the <strong>CipherTrust Manager (CRDP)</strong>. The returned ciphertext is then stored in the database. Plaintext never touches your storage.
            </p>
          </div>
        </section>

        {/* Display Section */}
        <section className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Database View (Encrypted)</h2>
                  <p className="text-sm text-slate-500">Enter a username to include with each reveal request.</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                  <label className="text-sm font-medium text-slate-600">Reveal Username</label>
                  <input
                    type="text"
                    value={revealUserName}
                    onChange={(e) => setRevealUserName(e.target.value)}
                    placeholder="Username for reveal"
                    className="w-full sm:w-64 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003764] focus:border-transparent outline-none transition"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={fetchRecords} className="text-[#003764] text-sm hover:underline">Refresh</button>
                <button onClick={handleClearRecords} className="text-red-600 text-sm hover:underline">Clear Database</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs uppercase text-slate-500 bg-slate-50/50">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Protected Email</th>
                    <th className="px-6 py-4">Protected Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
                    <tr key={record.id} className="text-sm hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 font-medium">{record.name}</td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[150px]">{revealedData[`${record.id}-email`] || record.email}</span>
                          {!revealedData[`${record.id}-email`] && (
                            <button 
                              onClick={() => handleReveal(record.id, 'email')}
                              className="text-xs text-blue-600 hover:text-blue-800 font-sans font-semibold underline"
                            >
                              Reveal
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[150px]">{revealedData[`${record.id}-credit_card`] || record.credit_card}</span>
                          {!revealedData[`${record.id}-credit_card`] && (
                            <button 
                              onClick={() => handleReveal(record.id, 'credit_card')}
                              className="text-xs text-blue-600 hover:text-blue-800 font-sans font-semibold underline"
                            >
                              Reveal
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400">No records found. Add one on the left!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Backend Startup Logs Section */}
        <section className="lg:col-span-3 mt-8">
          <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 overflow-hidden text-yellow-300 font-mono text-xs">
            <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center text-white">
              <h2 className="text-lg font-semibold">Backend Startup Log</h2>
              <button type="button" onClick={() => setBackendLogs([])} className="text-sm hover:underline text-slate-300">Clear Logs</button>
            </div>
            <div className="p-4 h-56 overflow-y-auto space-y-4">
              {backendLogs.map(log => (
                <div key={log.id} className="border-b border-slate-800 pb-2">
                  <div className="text-yellow-300">[{log.time}] {log.message}</div>
                  {log.details && (
                    <div className="text-slate-400 mt-1">
                      <div className="font-semibold">Details:</div>
                      {renderLogValue(log.details)}
                    </div>
                  )}
                </div>
              ))}
              {backendLogs.length === 0 && <div className="text-slate-500">No backend startup logs available.</div>}
            </div>
          </div>
        </section>

        {/* API Logs Section */}
        <section className="lg:col-span-3 mt-8">
          <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 overflow-hidden text-green-400 font-mono text-xs">
            <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center text-white">
              <h2 className="text-lg font-semibold">API Diagnostics Log</h2>
              <button type="button" onClick={() => setApiLogs([])} className="text-sm hover:underline text-slate-300">Clear Logs</button>
            </div>
            <div className="p-4 h-[32rem] overflow-y-auto space-y-4">
              {apiLogs.map(log => (
                <div key={log.id} className="border-b border-slate-800 pb-2">
                  <div className="text-blue-400">[{log.time}] {log.method} {log.url}</div>
                  {log.request && (
                    <div className="text-slate-400 mt-1">
                      <div className="font-semibold">Request:</div>
                      {renderLogValue(log.request)}
                    </div>
                  )}
                  {log.response && (
                    <div className="text-green-500 mt-1">
                      <div className="font-semibold">Response:</div>
                      {renderLogValue(log.response)}
                    </div>
                  )}
                  {log.error && (
                    <div className="text-red-500 mt-1">
                      <div className="font-semibold">Error:</div>
                      {renderLogValue(log.error)}
                    </div>
                  )}
                </div>
              ))}
              {apiLogs.length === 0 && <div className="text-slate-500">No API calls made yet.</div>}
            </div>
          </div>
        </section>

      </main>

      <footer className="mt-auto py-8 text-center text-slate-400 text-xs">
        &copy; 2026 Thales Group - CipherTrust Data Security Platform Demo
      </footer>
    </div>
  );
}

export default App;
