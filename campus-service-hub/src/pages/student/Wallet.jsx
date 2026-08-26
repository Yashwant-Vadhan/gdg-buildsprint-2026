import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import { Wallet as WalletIcon, UploadCloud, AlertCircle, FileText, CheckCircle2, XCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function Wallet() {
  const { user } = useAuth();
  
  const [balance, setBalance] = useState(0.00);
  const [transactions, setTransactions] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [semester, setSemester] = useState('Semester 1');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      if (isMockMode) {
        const mockBalance = localStorage.getItem(`wallet_balance_${user.id}`) || '1500.00';
        setBalance(parseFloat(mockBalance));

        const mockTxns = JSON.parse(localStorage.getItem(`wallet_txns_${user.id}`) || '[]');
        if (mockTxns.length === 0) {
          const initialTxns = [
            { id: 't1', service: 'fee_credit', amount: 2000.00, method: 'admin_credit', status: 'success', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
            { id: 't2', service: 'canteen', amount: 90.00, method: 'wallet', status: 'success', created_at: new Date(Date.now() - 86400000).toISOString() },
            { id: 't3', service: 'laundry', amount: 45.00, method: 'wallet', status: 'success', created_at: new Date().toISOString() },
          ];
          localStorage.setItem(`wallet_txns_${user.id}`, JSON.stringify(initialTxns));
          setTransactions(initialTxns);
        } else {
          setTransactions(mockTxns);
        }

        const mockReceipts = JSON.parse(localStorage.getItem(`wallet_receipts_${user.id}`) || '[]');
        if (mockReceipts.length === 0) {
          const initialReceipts = [
            { id: 'r1', semester: 'Semester 1', receipt_file_url: '#', status: 'approved', uploaded_at: new Date(Date.now() - 86400000 * 2).toISOString() }
          ];
          localStorage.setItem(`wallet_receipts_${user.id}`, JSON.stringify(initialReceipts));
          setReceipts(initialReceipts);
        } else {
          setReceipts(mockReceipts);
        }
        return;
      }

      const { data: walletData, error: walletErr } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (walletErr) throw walletErr;
      setBalance(walletData?.balance || 0.00);

      const { data: txnData, error: txnErr } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (txnErr) throw txnErr;
      setTransactions(txnData || []);

      const { data: receiptData, error: receiptErr } = await supabase
        .from('fee_receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (receiptErr) throw receiptErr;
      setReceipts(receiptData || []);

    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadReceipt = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!file) {
      setMessage({ text: 'Please select a file to upload.', type: 'error' });
      return;
    }

    const alreadyExists = receipts.some(
      r => r.semester === semester && (r.status === 'approved' || r.status === 'pending')
    );

    if (alreadyExists) {
      setMessage({
        text: `A receipt submission for ${semester} is already pending or approved.`,
        type: 'error'
      });
      return;
    }

    setUploading(true);

    try {
      if (isMockMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));

        const newReceipt = {
          id: 'receipt-' + Date.now(),
          user_id: user.id,
          semester,
          receipt_file_url: 'https://placeholder-url.com/receipt.pdf',
          status: 'pending',
          uploaded_at: new Date().toISOString()
        };

        const updatedReceipts = [newReceipt, ...receipts];
        localStorage.setItem(`wallet_receipts_${user.id}`, JSON.stringify(updatedReceipts));
        setReceipts(updatedReceipts);

        setMessage({ text: 'Fee receipt registered. The Hostel Committee will review it.', type: 'success' });
        setFile(null);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${semester}-${Date.now()}.${fileExt}`;
      
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(fileName, file);

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      const { error: insertErr } = await supabase
        .from('fee_receipts')
        .insert({
          user_id: user.id,
          semester,
          receipt_file_url: publicUrl,
          status: 'pending'
        });

      if (insertErr) throw insertErr;

      setMessage({ text: 'Receipt uploaded successfully.', type: 'success' });
      setFile(null);
      fetchWalletData();

    } catch (err) {
      console.error('Upload error:', err);
      setMessage({ text: err.message || 'Failed to upload fee receipt.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="text-[9px] font-black text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg flex items-center gap-1 uppercase">VERIFIED</span>;
      case 'rejected':
        return <span className="text-[9px] font-black text-brand bg-brand-light border border-brand-light px-2 py-0.5 rounded-lg flex items-center gap-1 uppercase">REJECTED</span>;
      default:
        return <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1 uppercase">PENDING</span>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left pb-10">
      
      {/* Left Column */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Wallet Balance Card */}
        <div className="bg-[#202124] text-white rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm border border-neutral-800 relative overflow-hidden">
          {/* Accent red stripes */}
          <div className="absolute top-0 left-0 right-0 kfc-stripes"></div>

          <div className="space-y-2 mt-2">
            <span className="text-[9px] text-brand uppercase font-black tracking-widest flex items-center gap-1">
              <WalletIcon className="w-4 h-4" /> DIGITAL LEDGER BALANCE
            </span>
            <p className="text-4xl font-black text-white">₹{balance.toFixed(2)}</p>
            <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Hosteller provisions budget card</p>
          </div>

          <div className="p-3 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-neutral-200 max-w-xs font-bold uppercase tracking-wider">
            ₹2,000 credit is loaded upon verified academic receipt approval.
          </div>
        </div>

        {/* Upload Fee Receipt Box */}
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm text-slate-800 dark:text-slate-100">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 m-0 uppercase tracking-tight">Load Wallet Credit</h2>
          <p className="text-xs text-neutral-550 dark:text-slate-400 font-semibold">Upload your fee receipt to redeem the ₹2,000.00 allowance.</p>

          {message.text && (
            <div className={`p-3 rounded-lg border text-xs font-bold flex gap-2.5 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border border-brand-light text-brand'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleUploadReceipt} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase tracking-wider">Select Term</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-2 py-2 bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-brand text-xs"
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase tracking-wider">Receipt Attachment</label>
                <input
                  type="file"
                  required
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-neutral-550 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-neutral-200 dark:file:border-slate-700 file:text-[10px] file:font-black file:uppercase file:bg-neutral-50 dark:file:bg-slate-800 file:text-neutral-700 dark:file:text-slate-300 hover:file:bg-neutral-100 dark:hover:file:bg-slate-700 file:cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-lg font-black uppercase tracking-widest transition-all text-xs cursor-pointer shadow flex items-center justify-center gap-1.5"
            >
              {uploading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 shrink-0" /> Upload receipt card
                </>
              )}
            </button>
          </form>
        </div>

        {/* Uploaded Receipts List */}
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm text-slate-800 dark:text-slate-100">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 m-0 uppercase tracking-wider">Document Track</h2>
          
          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-8 bg-neutral-100 rounded"></div>
            </div>
          ) : receipts.length === 0 ? (
            <p className="text-xs text-neutral-450 italic font-semibold">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {receipts.map((r) => (
                <div key={r.id} className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand shrink-0" />
                    <div>
                      <p className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{r.semester}</p>
                      <p className="text-[9px] text-slate-450 dark:text-slate-500 font-bold">Uploaded: {new Date(r.uploaded_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {getStatusBadge(r.status)}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Right Column: Transaction History */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm text-slate-800 dark:text-slate-100">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 m-0 uppercase tracking-wider">Statement of Account</h2>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black border-b border-neutral-100 dark:border-slate-800 pb-2">Ledger</p>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(n => <div key={n} className="h-10 bg-neutral-100 rounded"></div>)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-slate-450 italic font-bold py-4 text-center">No statement logs.</p>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((t) => {
                const isCredit = t.service === 'fee_credit' || t.service === 'wallet_topup';
                return (
                  <div key={t.id} className="flex justify-between items-center p-2.5 bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isCredit ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-brand border border-brand-light'
                      }`}>
                        {isCredit ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[9px]">{t.service.replace('_', ' ')}</p>
                        <p className="text-[8px] text-neutral-450 dark:text-slate-500 font-bold">{new Date(t.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`font-black ${isCredit ? 'text-green-700' : 'text-slate-800 dark:text-slate-100'}`}>
                      {isCredit ? '+' : '-'}₹{parseFloat(t.amount).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
