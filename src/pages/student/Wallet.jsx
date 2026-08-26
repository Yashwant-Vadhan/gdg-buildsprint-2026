import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import { Wallet as WalletIcon, UploadCloud, AlertCircle, FileText, ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';

export default function Wallet() {
  const { profile: user } = useAuth();
  const [walletBalance, setWalletBalance] = useState(0.00);
  const [receipts, setReceipts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [semester, setSemester] = useState('Semester 1');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchWalletBalance();
    fetchReceipts();
    fetchTransactions();

    if (!isMockMode) {
      const balanceSub = supabase
        .channel('wallet_balance_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, () => {
          fetchWalletBalance();
        })
        .subscribe();

      const receiptSub = supabase
        .channel('receipt_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_receipts', filter: `user_id=eq.${user.id}` }, () => {
          fetchReceipts();
        })
        .subscribe();

      const paymentSub = supabase
        .channel('payment_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` }, () => {
          fetchTransactions();
        })
        .subscribe();

      return () => {
        balanceSub.unsubscribe();
        receiptSub.unsubscribe();
        paymentSub.unsubscribe();
      };
    }
  }, []);

  const fetchWalletBalance = async () => {
    try {
      if (isMockMode) {
        const bal = parseFloat(localStorage.getItem(`wallet_balance_${user.id}`) || '0.00');
        setWalletBalance(bal);
        return;
      }
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      setWalletBalance(parseFloat(data.balance));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReceipts = async () => {
    try {
      if (isMockMode) {
        const stored = JSON.parse(localStorage.getItem(`wallet_receipts_${user.id}`) || '[]');
        setReceipts(stored);
        return;
      }
      const { data, error } = await supabase
        .from('fee_receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      setReceipts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      if (isMockMode) {
        const stored = JSON.parse(localStorage.getItem(`wallet_transactions_${user.id}`) || '[]');
        setTransactions(stored);
        return;
      }
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadReceipt = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setMessage({ text: 'Please select a fee receipt file to upload.', type: 'error' });
      return;
    }

    const hasAlreadyCredit = receipts.some(r => r.semester === semester && r.status === 'approved');
    if (hasAlreadyCredit) {
      setMessage({ text: `Semester fee allowance for ${semester} has already been credited.`, type: 'error' });
      return;
    }

    setUploading(true);
    setMessage({ text: '', type: '' });

    try {
      if (isMockMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const newReceipt = {
          id: 'receipt-' + Math.floor(100000 + Math.random() * 900000),
          user_id: user.id,
          semester,
          receipt_file_url: 'mock-file-url-path',
          status: 'pending',
          uploaded_at: new Date().toISOString()
        };

        const stored = JSON.parse(localStorage.getItem(`wallet_receipts_${user.id}`) || '[]');
        stored.unshift(newReceipt);
        localStorage.setItem(`wallet_receipts_${user.id}`, JSON.stringify(stored));
        setReceipts(stored);

        setMessage({ text: 'Receipt uploaded successfully. Waiting for committee approval.', type: 'success' });
        setSelectedFile(null);
        e.target.reset();
        return;
      }

      // Live mode upload
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${user.id}/${semester}_receipt_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('fee-receipts')
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('fee-receipts')
        .getPublicUrl(filePath);

      const { error: insertErr } = await supabase
        .from('fee_receipts')
        .insert({
          user_id: user.id,
          semester,
          receipt_file_url: publicUrlData.publicUrl,
          status: 'pending'
        });
      if (insertErr) throw insertErr;

      setMessage({ text: 'Receipt uploaded successfully. Waiting for committee approval.', type: 'success' });
      setSelectedFile(null);
      e.target.reset();
      fetchReceipts();

    } catch (err) {
      console.error(err);
      setMessage({ text: err.message || 'Failed to upload document. Please retry.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'approved') return <span className="px-2 py-0.5 bg-green-50 text-green-700 font-bold border border-green-200 rounded-lg">Approved</span>;
    if (status === 'rejected') return <span className="px-2 py-0.5 bg-red-50 text-brand font-bold border border-brand-light rounded-lg">Rejected</span>;
    return <span className="px-2 py-0.5 bg-slate-50 text-slate-500 font-bold border border-slate-200 rounded-lg">Pending</span>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left pb-10">
      
      {/* Left Column */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Balance Panel */}
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-805 dark:text-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-light text-brand flex items-center justify-center">
              <WalletIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-550 font-black uppercase tracking-wider">Available Wallet Balance</p>
              <p className="text-3xl font-black text-slate-808 dark:text-slate-100 mt-1">₹{walletBalance.toFixed(2)}</p>
            </div>
          </div>
          <div className="text-center sm:text-right shrink-0">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Hostel Utility Card</p>
            <p className="text-xs font-black text-brand uppercase tracking-wider mt-1 bg-brand-light px-2.5 py-1 rounded-lg">Realtime Ledger</p>
          </div>
        </div>

        {/* Upload Fee Receipt Box */}
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm text-slate-808 dark:text-slate-100">
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
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm text-slate-808 dark:text-slate-100">
          <h2 className="text-sm font-black text-slate-808 dark:text-slate-100 m-0 uppercase tracking-wider">Document Track</h2>
          
          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-8 bg-neutral-100 rounded"></div>
            </div>
          ) : receipts.length === 0 ? (
            <p className="text-xs text-neutral-450 italic font-semibold">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {receipts.map((r) => (
                <div key={r.id} className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-slate-805 border border-neutral-200 dark:border-slate-700 rounded-xl text-xs">
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

      {/* Right Column */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm text-slate-808 dark:text-slate-100">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 m-0 uppercase tracking-wider">Statement of Account</h2>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black border-b border-neutral-100 dark:border-slate-800 pb-2">Ledger</p>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(n => <div key={n} className="h-10 bg-neutral-100 rounded"></div>)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-neutral-450 italic font-bold py-4 text-center">No statement logs.</p>
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
