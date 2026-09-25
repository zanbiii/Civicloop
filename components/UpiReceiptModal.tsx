'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Award, Check, Download, X } from 'lucide-react';
import { type BountyInfo, bountyTotal } from '@/types/civic';
import { formatInr } from '@/lib/bounty';

interface UpiReceiptModalProps {
  bounty: BountyInfo | null;
  ticketTitle: string;
  volunteerUpiId: string | null;
  onClose: () => void;
}

function downloadCertificate(bounty: BountyInfo, ticketTitle: string): void {
  const total = formatInr(bountyTotal(bounty));
  const date = new Date(bounty.paidAt ?? Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
    <rect width="900" height="620" fill="#f0fdf4"/>
    <rect x="24" y="24" width="852" height="572" fill="none" stroke="#10b981" stroke-width="4"/>
    <rect x="44" y="44" width="812" height="532" fill="none" stroke="#10b981" stroke-width="1"/>
    <text x="450" y="120" font-family="Georgia,serif" font-size="34" fill="#065f46" text-anchor="middle">Certificate of Civic Impact</text>
    <text x="450" y="170" font-family="system-ui,sans-serif" font-size="15" fill="#475569" text-anchor="middle">Civicloop · Decentralized Civic Bounty Network</text>
    <text x="450" y="260" font-family="system-ui,sans-serif" font-size="17" fill="#334155" text-anchor="middle">This certifies that a verified civic repair was completed and paid for:</text>
    <text x="450" y="310" font-family="Georgia,serif" font-size="24" fill="#0f172a" text-anchor="middle">${ticketTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 70)}</text>
    <text x="450" y="380" font-family="system-ui,sans-serif" font-size="16" fill="#475569" text-anchor="middle">Payout: ${total} · Sponsored by ${bounty.csrSponsor}</text>
    <text x="450" y="415" font-family="system-ui,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Transaction ${bounty.transactionId ?? ''} · ${date}</text>
    <text x="450" y="500" font-family="system-ui,sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">Verified by CivicProof AI · Confirmed by the reporting citizen</text>
  </svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `civicloop-certificate-${bounty.transactionId?.replace(/[^a-z0-9]/gi, '') ?? 'impact'}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function UpiReceiptModal({ bounty, ticketTitle, volunteerUpiId, onClose }: UpiReceiptModalProps) {
  const reduceMotion = useReducedMotion();
  const transactionId = bounty?.transactionId ?? null;

  useEffect(() => {
    if (!transactionId || reduceMotion) return;
    confetti({ particleCount: 140, spread: 80, startVelocity: 45, origin: { y: 0.65 }, colors: ['#10b981', '#34d399', '#facc15', '#ffffff'] });
    const second = window.setTimeout(
      () => confetti({ particleCount: 80, spread: 100, startVelocity: 35, origin: { y: 0.6 }, colors: ['#10b981', '#34d399'] }),
      250,
    );
    return () => window.clearTimeout(second);
  }, [transactionId, reduceMotion]);

  return (
    <AnimatePresence>
      {bounty && (
        <motion.div
          className="fixed inset-0 z-[2200] flex items-center justify-center bg-slate-900/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-2xl"
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className="flex items-center justify-end px-4 pt-4">
              <button type="button" onClick={onClose} className="rounded-full p-1.5 text-emerald-100 hover:bg-white/10" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center px-6 pb-2 text-center">
              <motion.div
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
              >
                <Check className="h-9 w-9 text-white" strokeWidth={3} />
              </motion.div>
              <h2 className="mt-4 text-lg font-bold">Payment Successful</h2>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{formatInr(bountyTotal(bounty))}</p>
              <p className="text-xs text-emerald-100">
                Credited to {bounty.claimedByName ?? 'the volunteer'}
                {volunteerUpiId ? ` (${volunteerUpiId})` : ''}
              </p>
            </div>

            <div className="mx-4 mb-4 mt-3 space-y-2 rounded-2xl bg-white/10 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-emerald-100">Base Task</span>
                <span className="font-semibold">{formatInr(bounty.baseAmount)}</span>
              </div>
              {bounty.communityBonus > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-100">Community Boost</span>
                  <span className="font-semibold">{formatInr(bounty.communityBonus)}</span>
                </div>
              )}
              {bounty.goldBonus > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-emerald-100">
                    <Award className="h-3.5 w-3.5" /> Gold Star Quality Bonus
                  </span>
                  <span className="font-semibold">{formatInr(bounty.goldBonus)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-white/20 pt-2 text-xs text-emerald-100">
                <span>Sponsoring Partner</span>
                <span className="font-semibold text-white">{bounty.csrSponsor}</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-100">
                <span>Txn ID</span>
                <span className="font-mono font-semibold text-white">{bounty.transactionId}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => downloadCertificate(bounty, ticketTitle)}
              className="mx-4 mb-5 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/25"
            >
              <Download className="h-4 w-4" /> Download Digital Certificate of Civic Impact
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
