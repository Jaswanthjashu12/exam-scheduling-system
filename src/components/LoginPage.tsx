/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { School, GraduationCap, Eye, EyeOff, LogIn, UserPlus, ShieldCheck, BookOpen } from "lucide-react";

interface LoginPageProps {
  onLogin: (collegeName: string, username: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [collegeName, setCollegeName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load registered accounts from localStorage
  const getAccounts = (): Record<string, { password: string; collegeName: string }> => {
    const raw = localStorage.getItem("exam_scheduler_accounts");
    return raw ? JSON.parse(raw) : {};
  };

  const saveAccounts = (accounts: Record<string, { password: string; collegeName: string }>) => {
    localStorage.setItem("exam_scheduler_accounts", JSON.stringify(accounts));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!collegeName.trim()) {
      setError("Please enter your College / Institution name.");
      return;
    }
    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const accounts = getAccounts();

      if (mode === "register") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }
        if (adminCode.trim() !== "ADMIN2026") {
          setError("Invalid Admin Registration Code. Contact your institution administrator.");
          setLoading(false);
          return;
        }
        if (accounts[username.toLowerCase()]) {
          setError(`Username "${username}" is already registered. Please log in instead.`);
          setLoading(false);
          return;
        }
        accounts[username.toLowerCase()] = { password, collegeName: collegeName.trim() };
        saveAccounts(accounts);
        setSuccess("Account created successfully! Logging you in…");
        setTimeout(() => onLogin(collegeName.trim(), username), 1200);
      } else {
        const account = accounts[username.toLowerCase()];
        if (!account) {
          setError("No account found with this username. Please register first.");
          setLoading(false);
          return;
        }
        if (account.password !== password) {
          setError("Incorrect password. Please try again.");
          setLoading(false);
          return;
        }
        setSuccess("Login successful! Loading your dashboard…");
        setTimeout(() => onLogin(account.collegeName, username), 1000);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] flex items-center justify-center relative overflow-hidden font-sans">

      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[100px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[100px] animate-pulse" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-violet-600/5 blur-[80px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative w-full max-w-md px-4">

        {/* Header branding */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.15)] mx-auto">
            <School className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">ExamScheduler</h1>
            <p className="text-xs text-slate-500 mt-1">Academic Timetable Optimizer • v1.0.4</p>
          </div>
          {/* Feature pills */}
          <div className="flex justify-center gap-2 flex-wrap">
            {["AI Solver", "Anti-Cheat Seating", "Smart Reports"].map(f => (
              <span key={f} className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] text-slate-400 font-medium">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Main card */}
        <div className="bg-[#12151C]/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-hidden">

          {/* Tab switcher */}
          <div className="flex border-b border-slate-800 bg-[#0A0C10]/40">
            <button
              onClick={() => { setMode("login"); setError(null); setSuccess(null); }}
              className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
                mode === "login"
                  ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(null); setSuccess(null); }}
              className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
                mode === "register"
                  ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Register
            </button>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="p-7 space-y-4">

            {/* College name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-indigo-400" />
                College / Institution Name
              </label>
              <div className="relative">
                <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={collegeName}
                  onChange={e => setCollegeName(e.target.value)}
                  placeholder="e.g. State Institute of Technology"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0A0C10] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition font-medium"
                />
              </div>
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Username / Admin ID
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. admin_registrar"
                className="w-full px-4 py-2.5 bg-[#0A0C10] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-4 pr-10 py-2.5 bg-[#0A0C10] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Register-only fields */}
            {mode === "register" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-4 pr-10 py-2.5 bg-[#0A0C10] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    Admin Registration Code
                  </label>
                  <input
                    type="text"
                    required
                    value={adminCode}
                    onChange={e => setAdminCode(e.target.value)}
                    placeholder="Contact your institution IT admin"
                    className="w-full px-4 py-2.5 bg-[#0A0C10] border border-amber-900/40 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/40 transition font-mono tracking-widest"
                  />
                  <p className="text-[10px] text-slate-600">Default code for demo: <span className="text-amber-500 font-mono font-bold">ADMIN2026</span></p>
                </div>
              </>
            )}

            {/* Error / Success messages */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 text-[11px] font-medium flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠</span> {error}
              </div>
            )}
            {success && (
              <div className="px-4 py-3 rounded-xl bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 text-[11px] font-medium flex items-start gap-2">
                <span className="shrink-0 mt-0.5">✓</span> {success}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </span>
              ) : (
                <>
                  {mode === "login" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {mode === "login" ? "Sign In to Dashboard" : "Create Account & Sign In"}
                </>
              )}
            </button>

            {/* Mode switcher hint */}
            <p className="text-center text-[11px] text-slate-600 pt-1">
              {mode === "login" ? (
                <>Don't have an account?{" "}
                  <button type="button" onClick={() => { setMode("register"); setError(null); }} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition">
                    Register here
                  </button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button type="button" onClick={() => { setMode("login"); setError(null); }} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-slate-700 mt-6">
          Secure • Local Storage Only • No data leaves your browser
        </p>
      </div>
    </div>
  );
}
