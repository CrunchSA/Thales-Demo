import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [formData, setFormData] = useState({ name: '', email: '', credit_card: '' });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revealedData, setRevealedData] = useState({});

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await axios.get(`${API_BASE}/records`);
      setRecords(response.data);
    } catch (err) {
      console.error("Failed to fetch records", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/save`, formData);
      setFormData({ name: '', email: '', credit_card: '' });
      fetchRecords();
    } catch (err) {
      alert("Error saving record: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = async (id, field) => {
    try {
      const response = await axios.post(`${API_BASE}/reveal`, { id, field });
      setRevealedData(prev => ({
        ...prev,
        [`${id}-${field}`]: response.data.revealed
      }));
    } catch (err) {
      alert("Reveal failed: " + err.message);
    }
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
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Email (PII - Protected)</label>
                <input 
                  type="email" 
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003764] focus:border-transparent outline-none transition"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Credit Card (Sensitive - Protected)</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003764] focus:border-transparent outline-none transition"
                  value={formData.credit_card}
                  onChange={(e) => setFormData({...formData, credit_card: e.target.value})}
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
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">Database View (Encrypted)</h2>
              <button onClick={fetchRecords} className="text-[#003764] text-sm hover:underline">Refresh</button>
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
                      <td colSpan="3" className="px-6 py-12 text-center text-slate-400">No records found. Add one on the left!</td>
                    </tr>
                  )}
                </tbody>
              </table>
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
