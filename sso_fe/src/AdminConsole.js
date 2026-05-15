import React, { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode as jwt_decode } from "jwt-decode";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Menu } from "primereact/menu";
import { Toast } from "primereact/toast";
import { FilterMatchMode } from "primereact/api";
import GILogo from "./staticFiles/GILogo.png";
import "./AdminConsole.css";

const API_BASE = "https://sso.erldc.in:5000";

const DEPARTMENTS = [
	{ label: "Information Technology (IT)", value: "IT" },
	{ label: "Market Operation (MO)",        value: "MO" },
	{ label: "System Operation (SO)",        value: "SO" },
	{ label: "Control Room (CR)",            value: "CR" },
	{ label: "SCADA",                        value: "SCADA" },
	{ label: "Contracts & Services (CS)",    value: "CS" },
	{ label: "Technical Services (TS)",      value: "TS" },
	{ label: "Human Resource (HR)",          value: "HR" },
	{ label: "Communication",               value: "COMMUNICATION" },
	{ label: "Finance & Accounts (F&A)",    value: "F&A" },
];

const EMPTY_FORM = { username: "", name: "", department: "", email: "", phone: "", password: "" };

export default function AdminConsole() {
	const navigate = useNavigate();
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [globalFilterValue, setGlobalFilterValue] = useState("");
	const [filters, setFilters] = useState({ global: { value: null, matchMode: FilterMatchMode.CONTAINS } });

	// Dialog visibility
	const [userDialog,         setUserDialog]         = useState(false);
	const [pwdDialog,          setPwdDialog]          = useState(false);
	const [delDialog,          setDelDialog]          = useState(false);
	const [unlockDialog,       setUnlockDialog]       = useState(false);
	const [detailDialog,       setDetailDialog]       = useState(false);
	const [forceChangeDialog,  setForceChangeDialog]  = useState(false);
	const [sendOtpDialog,      setSendOtpDialog]      = useState(false);

	const [selectedUser, setSelectedUser] = useState(null);
	const [formData, setFormData]         = useState(EMPTY_FORM);
	const [isEdit, setIsEdit]             = useState(false);
	const [submitting, setSubmitting]     = useState(false);

	// New feature state
	const [quickFilter,   setQuickFilter]   = useState("all");
	const [deptFilter,    setDeptFilter]    = useState(null);
	const [detailData,    setDetailData]    = useState(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [otpResult,     setOtpResult]     = useState(null);
	const [lastRefresh,   setLastRefresh]   = useState(null); // Date object
	const [copiedId,      setCopiedId]      = useState(null); // tracks which cell just copied

	const toastRef = useRef(null);

	// Helper: show toast instead of alert()
	const toast = useCallback((severity, summary, detail) => {
		toastRef.current?.show({ severity, summary, detail, life: 4000 });
	}, []);

	// Helper: copy text to clipboard with visual feedback
	const copyToClipboard = (text, id) => {
		navigator.clipboard?.writeText(text).then(() => {
			setCopiedId(id);
			setTimeout(() => setCopiedId(null), 1800);
			toast("success", "Copied!", `"${text}" copied to clipboard`);
		});
	};

	// ── Auth guard ──────────────────────────────────────────────────────
	useEffect(() => {
		const token = localStorage.getItem("token");
		if (!token) { navigate("/"); return; }
		try {
			const decoded = jwt_decode(token);
			if (!decoded.Login || decoded.Department !== "Information Technology (IT)") {
				navigate("/dashboard");
			}
		} catch { navigate("/"); }
	}, [navigate]);

	// ── Data ────────────────────────────────────────────────────────────
	const getHeaders = useCallback(() => ({
		headers: { Token: localStorage.getItem("token") }
	}), []);

	const fetchUsers = useCallback(async () => {
		setLoading(true);
		try {
			const res = await axios.get(`${API_BASE}/admin/users`, getHeaders());
			setUsers(res.data);
			setLastRefresh(new Date());
		} catch (err) {
			if (err.response?.status === 401 || err.response?.status === 403) {
				navigate("/dashboard");
			} else {
				toast("error", "Load Failed", "Could not fetch user list. Check network or backend.");
			}
		} finally {
			setLoading(false);
		}
	}, [getHeaders, navigate, toast]);

	useEffect(() => { fetchUsers(); }, [fetchUsers]);

	// ── Filter ──────────────────────────────────────────────────────────
	const onGlobalFilterChange = (e) => {
		const value = e.target.value;
		setFilters(f => ({ ...f, global: { value, matchMode: FilterMatchMode.CONTAINS } }));
		setGlobalFilterValue(value);
	};

	// Filtered user list based on quick-filter pill + dept dropdown
	const filteredUsers = users.filter(u => {
		if (deptFilter && u.Department !== deptFilter) return false;
		switch (quickFilter) {
			case "active":   return u.Status === "Active";
			case "disabled": return u.Status === "Disabled";
			case "locked":   return u.Locked;
			case "expiring": return u.PwdExpiry !== null && u.PwdExpiry !== undefined && u.PwdExpiry > 0 && u.PwdExpiry <= 7;
			case "expired":  return u.PwdExpiry === 0;
			default:         return true;
		}
	});

	// ── Dialog helpers ──────────────────────────────────────────────────
	const hideAll = () => {
		setUserDialog(false); setPwdDialog(false); setDelDialog(false); setUnlockDialog(false);
		setDetailDialog(false); setForceChangeDialog(false); setSendOtpDialog(false);
		setSelectedUser(null); setFormData(EMPTY_FORM); setSubmitting(false);
		setOtpResult(null);
	};

	const openNewUser = () => {
		setIsEdit(false); setFormData(EMPTY_FORM); setUserDialog(true);
	};

	const openEditUser = (user) => {
		setIsEdit(true); setSelectedUser(user);
		// Pre-populate department: match the user's displayed department name to a DEPARTMENTS value
		const deptEntry = DEPARTMENTS.find(d => d.label === user.Department);
		setFormData({
			...EMPTY_FORM,
			username: user.Emp_id,
			name: user.Name,
			email: user.Mail,
			phone: user.Mobile,
			department: deptEntry ? deptEntry.value : "",
		});
		setUserDialog(true);
	};

	const openResetPwd   = (user) => { setSelectedUser(user); setFormData(EMPTY_FORM); setPwdDialog(true); };
	const openDelDialog  = (user) => { setSelectedUser(user); setDelDialog(true); };
	const openUnlockDialog = (user) => { setSelectedUser(user); setUnlockDialog(true); };

	// ── API calls ────────────────────────────────────────────────────────
	const handleSaveUser = async () => {
		setSubmitting(true);
		try {
			if (isEdit) {
				await axios.put(`${API_BASE}/admin/users/${selectedUser.Emp_id}`, formData, getHeaders());
				toast("success", "User Updated", `${formData.name || selectedUser.Name} has been updated successfully.`);
			} else {
				await axios.post(`${API_BASE}/admin/users`, formData, getHeaders());
				toast("success", "User Created", `${formData.name} has been added to Active Directory.`);
			}
			hideAll(); fetchUsers();
		} catch (err) {
			toast("error", "Save Failed", err.response?.data?.error || err.message);
			setSubmitting(false);
		}
	};

	const handleDeleteUser = async () => {
		setSubmitting(true);
		const name = selectedUser.Name;
		try {
			await axios.delete(`${API_BASE}/admin/users/${selectedUser.Emp_id}`, getHeaders());
			toast("warn", "User Deleted", `${name} has been permanently removed from Active Directory.`);
			hideAll(); fetchUsers();
		} catch (err) {
			toast("error", "Delete Failed", err.response?.data?.error || err.message);
			setSubmitting(false);
		}
	};

	const handleResetPassword = async () => {
		setSubmitting(true);
		try {
			await axios.post(`${API_BASE}/admin/users/${selectedUser.Emp_id}/reset-password`, { password: formData.password }, getHeaders());
			toast("success", "Password Reset", `Password for ${selectedUser.Name} has been reset successfully.`);
			hideAll();
		} catch (err) {
			toast("error", "Reset Failed", err.response?.data?.error || err.message);
			setSubmitting(false);
		}
	};

	const toggleStatus = async (user) => {
		const enable = user.Status === "Disabled";
		try {
			await axios.post(`${API_BASE}/admin/users/${user.Emp_id}/toggle-status`, { enable }, getHeaders());
			toast("success", enable ? "Account Enabled" : "Account Disabled", `${user.Name} is now ${enable ? "active" : "disabled"}.`);
			fetchUsers();
		} catch (err) {
			toast("error", "Action Failed", err.response?.data?.error || err.message);
		}
	};

	const handleUnlockUser = async () => {
		setSubmitting(true);
		try {
			await axios.post(`${API_BASE}/admin/users/${selectedUser.Emp_id}/unlock`, {}, getHeaders());
			toast("success", "Account Unlocked", `${selectedUser.Name}'s account lockout has been cleared.`);
			hideAll(); fetchUsers();
		} catch (err) {
			toast("error", "Unlock Failed", err.response?.data?.error || err.message);
			setSubmitting(false);
		}
	};

	const openDetailPanel = async (user) => {
		setSelectedUser(user);
		setDetailData(null);
		setDetailDialog(true);
		setDetailLoading(true);
		try {
			const res = await axios.get(`${API_BASE}/admin/users/${user.Emp_id}/detail`, getHeaders());
			setDetailData(res.data);
		} catch (err) {
			setDetailData({ error: err.response?.data?.error || err.message });
		} finally {
			setDetailLoading(false);
		}
	};

	const handleForcePasswordChange = async () => {
		setSubmitting(true);
		try {
			await axios.post(`${API_BASE}/admin/users/${selectedUser.Emp_id}/force-password-change`, {}, getHeaders());
			toast("warn", "Force Change Set", `${selectedUser.Name} will be prompted to change their password at next login.`);
			hideAll(); fetchUsers();
		} catch (err) {
			toast("error", "Action Failed", err.response?.data?.error || err.message);
			setSubmitting(false);
		}
	};

	const handleSendResetOtp = async () => {
		setSubmitting(true);
		try {
			const res = await axios.post(`${API_BASE}/admin/users/${selectedUser.Emp_id}/send-reset-otp`, {}, getHeaders());
			setOtpResult(res.data);
			setSubmitting(false);
		} catch (err) {
			toast("error", "OTP Failed", err.response?.data?.error || err.message);
			setSubmitting(false);
		}
	};

	const handleExportCsv = async () => {
		toast("info", "Exporting…", "Preparing CSV, download will start shortly.");
		try {
			const res = await axios.get(`${API_BASE}/admin/export`, {
				...getHeaders(),
				responseType: "blob",   // tells axios to give us raw bytes, not parsed JSON
			});
			// Pull filename from Content-Disposition if present, otherwise use default
			const disposition = res.headers["content-disposition"] || "";
			const match = disposition.match(/filename="?([^"]+)"?/);
			const filename = match ? match[1] : `ERLDC_AD_Users_${new Date().toISOString().slice(0,10)}.csv`;

			const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast("success", "Export Complete", `Downloaded: ${filename}`);
		} catch (err) {
			// When axios gets a non-2xx with responseType:blob, parse the error body manually
			let msg = "Could not generate CSV. Please try again.";
			if (err.response?.data instanceof Blob) {
				try {
					const text = await err.response.data.text();
					const parsed = JSON.parse(text);
					msg = parsed.error || msg;
				} catch { /* ignore */ }
			} else {
				msg = err.response?.data?.error || err.message || msg;
			}
			toast("error", "Export Failed", msg);
		}
	};

	// ── Derived stats ────────────────────────────────────────────────────
	const totalUsers    = users.length;
	const activeUsers   = users.filter(u => u.Status === "Active").length;
	const disabledUsers = users.filter(u => u.Status === "Disabled").length;
	const lockedUsers   = users.filter(u => u.Locked).length;
	const expiringUsers = users.filter(u => u.PwdExpiry !== null && u.PwdExpiry !== undefined && u.PwdExpiry > 0 && u.PwdExpiry <= 7).length;
	const expiredUsers  = users.filter(u => u.PwdExpiry === 0).length;

	// ── Cell templates ───────────────────────────────────────────────────
	const rowNumBody = (_, opts) => (
		<span className="admin-row-num">{opts.rowIndex + 1}</span>
	);

	const nameBody = (rowData) => (
		<span className="admin-name-cell admin-name-clickable" onClick={() => openDetailPanel(rowData)} title="Click to view full profile">
			<i className="pi pi-user" />
			{rowData.Name}
			<i className="pi pi-external-link" style={{ fontSize: "0.6rem", opacity: 0.5 }} />
		</span>
	);

	const empidBody = (rowData) => {
		const id = rowData.Emp_id;
		const copied = copiedId === `id-${id}`;
		return (
			<span className="admin-copy-cell" onClick={() => copyToClipboard(id, `id-${id}`)} title="Click to copy">
				<code className="admin-empid">{id}</code>
				<i className={`pi ${copied ? "pi-check" : "pi-copy"} admin-copy-icon${copied ? " admin-copy-icon--ok" : ""}`} />
			</span>
		);
	};

	const deptBody = (rowData) => (
		<span className="admin-dept-badge">{rowData.Department}</span>
	);

	const mailBody = (rowData) => {
		const mail = rowData.Mail;
		const copied = copiedId === `mail-${mail}`;
		return (
			<span className="admin-copy-cell">
				<a href={`mailto:${mail}`} className="admin-mail-link" onClick={e => e.stopPropagation()}>
					<i className="pi pi-envelope" />
					{mail}
				</a>
				<i className={`pi ${copied ? "pi-check" : "pi-copy"} admin-copy-icon${copied ? " admin-copy-icon--ok" : ""}`}
					onClick={() => copyToClipboard(mail, `mail-${mail}`)}
					title="Copy email"
				/>
			</span>
		);
	};

	const statusBody = (rowData) => {
		const isActive = rowData.Status === "Active";
		return (
			<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
				<span className={`admin-status-badge ${isActive ? "status-active" : "status-disabled"}`}>
					{rowData.Status}
				</span>
				{rowData.Locked && (
					<span className="admin-status-badge status-locked">
						<i className="pi pi-lock" style={{ fontSize: "0.65rem" }} />
						&nbsp;Locked
					</span>
				)}
			</div>
		);
	};

	const pwdExpiryBody = (rowData) => {
		const days = rowData.PwdExpiry;

		// null means the password never expires (DONT_EXPIRE_PASSWORD flag or domain policy = never)
		if (days === null || days === undefined) {
			return (
				<span className="admin-expiry-badge admin-expiry-never">
					<i className="pi pi-infinity" style={{ fontSize: "0.65rem" }} />
					&nbsp;Never
				</span>
			);
		}

		if (days === 0) {
			return (
				<span className="admin-expiry-badge admin-expiry-expired">
					<i className="pi pi-times-circle" style={{ fontSize: "0.65rem" }} />
					&nbsp;Expired
				</span>
			);
		}

		const cls =
			days <= 3  ? "admin-expiry-critical" :
			days <= 7  ? "admin-expiry-warning"  :
			days <= 30 ? "admin-expiry-soon"     :
			             "admin-expiry-ok";

		return (
			<span className={`admin-expiry-badge ${cls}`}>
				{days}d
			</span>
		);
	};

	// ── Per-row action menu ───────────────────────────────────────────────
	const actionMenuRef = useRef(null);
	const [menuItems,    setMenuItems]    = useState([]);

	const actionBody = (rowData) => {
		const handleActionsClick = (e) => {
			const isActive = rowData.Status === "Active";
			const items = [
				{ label: "View Full Profile", icon: "pi pi-id-card",  command: () => openDetailPanel(rowData) },
				{ label: "Edit User Details", icon: "pi pi-pencil",   command: () => openEditUser(rowData) },
				{ label: "Reset Password",    icon: "pi pi-key",      command: () => openResetPwd(rowData) },
				{ label: "Force Pwd Change",  icon: "pi pi-refresh",  className: "action-menu-disable", command: () => { setSelectedUser(rowData); setForceChangeDialog(true); } },
				{ label: "Send Reset OTP",    icon: "pi pi-envelope", className: "action-menu-enable",  command: () => { setSelectedUser(rowData); setOtpResult(null); setSendOtpDialog(true); } },
				{ separator: true },
				{
					label:     "Unlock Account",
					icon:      "pi pi-lock-open",
					className: rowData.Locked ? "action-menu-unlock" : "action-menu-unlock-off",
					disabled:  !rowData.Locked,
					command:   () => openUnlockDialog(rowData),
				},
				{
					label:     isActive ? "Disable Account" : "Enable Account",
					icon:      isActive ? "pi pi-ban" : "pi pi-check-circle",
					className: isActive ? "action-menu-disable" : "action-menu-enable",
					command:   () => toggleStatus(rowData),
				},
				{ separator: true },
				{ label: "Delete User", icon: "pi pi-trash", className: "action-menu-delete", command: () => openDelDialog(rowData) },
			];

			// flushSync forces React to update the Menu model synchronously
			// before .show() reads it, guaranteeing the right items appear.
			flushSync(() => setMenuItems(items));
			actionMenuRef.current?.show(e);
		};
		return (
			<div className="action-cell">
				<Button
					label="Actions"
					icon="pi pi-chevron-down"
					iconPos="right"
					className="admin-action-trigger"
					onClick={handleActionsClick}
				/>
			</div>
		);
	};

	// ── Table toolbar ─────────────────────────────────────────────────────
	const deptFilterOptions = [
		{ label: "All Departments", value: null },
		...DEPARTMENTS.map(d => ({ label: d.label, value: d.label })),
	];

	const refreshLabel = lastRefresh
		? `Updated ${lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
		: "";

	const tableHeader = (
		<div style={{ background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(220,38,38,0.10)" }}>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", gap: 10, flexWrap: "wrap" }}>
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					<Button label="Add New User" icon="pi pi-user-plus" className="admin-add-btn" onClick={openNewUser} />
					<Button label="Export CSV" icon="pi pi-download" className="admin-export-btn" onClick={handleExportCsv} />
					<Button
						icon={loading ? "pi pi-spin pi-spinner" : "pi pi-refresh"}
						className="admin-refresh-btn"
						onClick={fetchUsers}
						disabled={loading}
						title={refreshLabel || "Refresh user list"}
					/>
					{refreshLabel && <span className="admin-refresh-ts"><i className="pi pi-clock" />{refreshLabel}</span>}
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<Dropdown value={deptFilter} options={deptFilterOptions} onChange={e => setDeptFilter(e.value)} placeholder="All Departments" className="admin-dept-filter" />
					<span className="admin-search">
						<i className="pi pi-search" style={{ color: "#94a3b8" }} />
						<InputText value={globalFilterValue} onChange={onGlobalFilterChange} placeholder="Search name, ID, dept, email…" className="admin-search-input" />
						{globalFilterValue && (
							<i className="pi pi-times" style={{ color: "#94a3b8", cursor: "pointer" }}
								onClick={() => { setGlobalFilterValue(""); setFilters(f => ({ ...f, global: { value: null, matchMode: FilterMatchMode.CONTAINS } })); }}
								title="Clear search"
							/>
						)}
					</span>
				</div>
			</div>
			<div className="admin-quick-filters">
				{[
					{ key: "all",      label: "All",          count: totalUsers },
					{ key: "active",   label: "Active",       count: activeUsers },
					{ key: "disabled", label: "Disabled",     count: disabledUsers },
					{ key: "locked",   label: "Locked Out",   count: lockedUsers },
					{ key: "expiring", label: "Expiring ≤7d", count: expiringUsers },
					{ key: "expired",  label: "Pwd Expired",  count: expiredUsers },
				].map(f => (
					<button key={f.key} type="button"
						className={`admin-qf-pill ${quickFilter === f.key ? "admin-qf-pill--active" : ""}`}
						onClick={() => setQuickFilter(f.key)}>
						{f.label}
						<span className="admin-qf-count">{loading ? "—" : f.count}</span>
					</button>
				))}
			</div>
		</div>
	);

	// ── Row class for tinting ────────────────────────────────────────────
	const rowClassName = (rowData) => {
		if (rowData.Locked)                                                           return "admin-row--locked";
		if (rowData.Status === "Disabled")                                            return "admin-row--disabled";
		if (rowData.PwdExpiry === 0)                                                  return "admin-row--expired";
		if (rowData.PwdExpiry !== null && rowData.PwdExpiry !== undefined && rowData.PwdExpiry <= 3) return "admin-row--critical";
		if (rowData.PwdExpiry !== null && rowData.PwdExpiry !== undefined && rowData.PwdExpiry <= 7) return "admin-row--expiring";
		return "";
	};

	// ── Contextual empty state ───────────────────────────────────────────
	const emptyMessages = {
		all:      { icon: "pi-users",        text: "No users found in Active Directory." },
		active:   { icon: "pi-check-circle", text: "No active accounts found." },
		disabled: { icon: "pi-ban",          text: "No disabled accounts — all accounts are active.", good: true },
		locked:   { icon: "pi-lock",         text: "No locked accounts — all clear!",                 good: true },
		expiring: { icon: "pi-clock",        text: "No passwords expiring within 7 days — all clear!", good: true },
		expired:  { icon: "pi-times-circle", text: "No expired passwords — all clear!",               good: true },
	};
	const em = emptyMessages[quickFilter] || emptyMessages.all;
	const emptyMessage = (
		<div className={`admin-empty${em.good ? " admin-empty--good" : ""}`}>
			<i className={`pi ${em.icon}`} />
			<p>{em.text}</p>
			{quickFilter !== "all" && (
				<button type="button" className="admin-empty-reset" onClick={() => setQuickFilter("all")}>
					<i className="pi pi-arrow-left" /> Show all accounts
				</button>
			)}
		</div>
	);


	return (
		<main className="admin-shell">
			<Toast ref={toastRef} position="top-right" />
			{/* ── Nav ─────────────────────────────────────────────────── */}
			<nav className="admin-nav" aria-label="Admin Console navigation">
				<div className="admin-nav__brand">
					<img src={GILogo} alt="Grid India" />
					<span className="admin-nav__brand-title">ERLDC SSO</span>
					<div className="admin-nav__brand-divider" />
					<span className="admin-badge">
						<i className="pi pi-shield" />
						Admin Console
					</span>
				</div>
				<div className="admin-nav__actions">
					<button type="button" className="admin-back-btn" onClick={() => navigate("/dashboard")}>
						<i className="pi pi-arrow-left" />
						Back to Dashboard
					</button>
					<Button
						className="dashboard-logout dashboard-logout--nav"
						icon="pi pi-sign-out"
						label="Logout"
						onClick={() => { localStorage.removeItem("token"); navigate("/"); }}
					/>
				</div>
			</nav>

			{/* ── Hero ─────────────────────────────────────────────────── */}
			<section className="admin-hero">
				<div className="admin-hero__content">
					<div className="admin-brand">
						<img src={GILogo} alt="Grid India" className="admin-brand__logo" />
						<div>
							<p className="admin-brand__eyebrow">ERLDC, Grid India — Restricted Access</p>
							<h1>Active Directory Control</h1>
							<p className="admin-brand__copy">
								Manage user accounts, credentials, department assignments, and access privileges across the ERLDC network.
							</p>
						</div>
					</div>
				</div>
				<div className="admin-hero-stats">
					{[
						{ key: "all",      label: "Total Accounts", count: totalUsers,    color: null },
						{ key: "active",   label: "Active",         count: activeUsers,   color: "#86efac" },
						{ key: "disabled", label: "Disabled",        count: disabledUsers, color: "#fca5a5" },
						{ key: "locked",   label: "Locked Out",      count: lockedUsers,   color: "#fbbf24" },
						{ key: "expiring", label: "Expiring ≤7d",    count: expiringUsers, color: "#f97316" },
						{ key: "expired",  label: "Pwd Expired",     count: expiredUsers,  color: "#f87171" },
					].map(stat => (
						<button
							key={stat.key}
							type="button"
							className={`admin-hero-stat admin-hero-stat--btn${quickFilter === stat.key ? " admin-hero-stat--active" : ""}`}
							onClick={() => setQuickFilter(stat.key)}
							title={`Filter table: ${stat.label}`}
						>
							<span style={stat.color ? { color: stat.color } : {}}>{loading ? "—" : stat.count}</span>
							<p>{stat.label}</p>
							{quickFilter === stat.key && <span className="admin-hero-stat__indicator">▼ Filtering</span>}
						</button>
					))}
				</div>
			</section>

			{/* ── Workspace ────────────────────────────────────────────── */}
			<section className="admin-workspace">
				<div className="admin-section-heading">
					<div>
						<p>Restricted — IT Department Only</p>
						<h2>
							User Directory
							{quickFilter !== "all" && (
								<span className="admin-filter-crumb">
									<i className="pi pi-filter-fill" />
									{{
										active:   "Active accounts",
										disabled: "Disabled accounts",
										locked:   "Locked-out accounts",
										expiring: "Expiring within 7 days",
										expired:  "Password expired",
									}[quickFilter]}
									<button type="button" className="admin-filter-crumb__clear" onClick={() => setQuickFilter("all")} title="Clear filter">
										<i className="pi pi-times" />
									</button>
								</span>
							)}
						</h2>
					</div>
					<span>{loading ? "" : `${filteredUsers.length} of ${totalUsers} accounts`}</span>
				</div>

				{/* Single shared popup menu for all action triggers */}
				<Menu
					model={menuItems}
					popup
					ref={actionMenuRef}
					appendTo={document.body}
					className="admin-action-menu"
				/>

				<DataTable
					value={filteredUsers}
					loading={loading}
					filters={filters}
					globalFilterFields={["Name", "Emp_id", "Department", "Mail", "Mobile", "Status", "PwdExpiry"]}
					header={tableHeader}
					emptyMessage={emptyMessage}
					rowClassName={rowClassName}
					paginator
					rows={15}
					rowsPerPageOptions={[15, 30, 50]}
					stripedRows
					showGridlines
					sortMode="multiple"
					className="admin-table"
					style={{ borderRadius: "8px", overflow: "hidden", boxShadow: "0 18px 48px rgba(21,33,52,0.10)" }}
				>
					<Column header="#" body={rowNumBody} style={{ width: "3.5rem", textAlign: "center" }} />
					<Column field="Name"       header="Employee Name"  body={nameBody}   sortable style={{ width: "18%" }} />
					<Column field="Emp_id"     header="Username / ID"  body={empidBody}  sortable style={{ width: "10%" }} />
					<Column field="Department" header="Department"      body={deptBody}   sortable style={{ width: "20%" }} />
					<Column field="Mail"       header="E-Mail Address"  body={mailBody}   sortable style={{ width: "22%" }} />
					<Column field="Mobile"     header="Phone"           sortable          style={{ width: "12%" }} />
					<Column field="Status"     header="Status"          body={statusBody}    sortable align="center" style={{ width: "9%" }} />
					<Column field="PwdExpiry"  header="Pwd Expiry"       body={pwdExpiryBody} sortable align="center" style={{ width: "9%" }} />
					<Column header="Actions"   body={actionBody}         align="center"       style={{ width: "130px", minWidth: "130px" }} />
				</DataTable>
			</section>

			{/* ── Create / Edit Dialog ─────────────────────────────────── */}
			<Dialog
				visible={userDialog}
				style={{ width: "480px" }}
				header={
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", fontSize: "1.2rem" }}>
							<i className={isEdit ? "pi pi-pencil" : "pi pi-user-plus"} style={{ color: "#fff" }} />
						</span>
						<span style={{ color: "#fff", fontWeight: 900 }}>{isEdit ? "Edit User Details" : "Create New AD User"}</span>
					</div>
				}
				modal
				className="admin-dialog"
				onHide={hideAll}
			>
				<div className="admin-field">
					<label>Full Name *</label>
					<InputText value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus placeholder="e.g. Rajesh Kumar" />
				</div>
				<div className="admin-field">
					<label>Username / Employee ID *</label>
					<InputText value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} disabled={isEdit} placeholder="e.g. 10045" />
				</div>
				<div className="admin-field">
					<label>Department {isEdit && <span style={{ color: '#64748b', fontWeight: 400, textTransform: 'none', fontSize: '0.78rem' }}>(changing moves user to new OU)</span>}</label>
					<Dropdown value={formData.department} options={DEPARTMENTS} onChange={e => setFormData({ ...formData, department: e.value })} placeholder="Select a Department" />
				</div>
				<div className="admin-field">
					<label>Email Address</label>
					<InputText type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="e.g. user@grid-india.in" />
				</div>
				<div className="admin-field">
					<label>Phone Number</label>
					<InputText value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="e.g. +91-11-XXXXXXXX" />
				</div>
				{!isEdit && (
					<div className="admin-field">
						<label>Initial Password *</label>
						<InputText type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Min 8 chars, mixed case + digit + symbol" />
					</div>
				)}
				<div className="admin-dialog-footer">
					<Button label="Cancel" icon="pi pi-times" className="p-button-text p-button-secondary" onClick={hideAll} disabled={submitting} />
					<Button label={isEdit ? "Save Changes" : "Create User"} icon="pi pi-check" className="admin-save-btn" onClick={handleSaveUser} loading={submitting} />
				</div>
			</Dialog>

			{/* ── Reset Password Dialog ────────────────────────────────── */}
			<Dialog
				visible={pwdDialog}
				style={{ width: "420px" }}
				header={
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.18)", fontSize: "1.2rem" }}>
							<i className="pi pi-key" style={{ color: "#fff" }} />
						</span>
						<span style={{ color: "#fff", fontWeight: 900 }}>Force Reset Password</span>
					</div>
				}
				modal
				className="admin-dialog"
				onHide={hideAll}
			>
				<div className="admin-confirm-box" style={{ background: "rgba(220,38,38,0.05)", borderColor: "rgba(220,38,38,0.15)", marginBottom: "1.25rem" }}>
					<i className="pi pi-user" style={{ fontSize: "1.4rem", color: "#dc2626" }} />
					<div>
						<strong>{selectedUser?.Name}</strong>
						<p>ID: <code>{selectedUser?.Emp_id}</code> &nbsp;·&nbsp; {selectedUser?.Department}</p>
					</div>
				</div>
				<div className="admin-field">
					<label>New Password *</label>
					<InputText type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Min 8 chars, mixed case + digit + symbol" autoFocus />
				</div>
				<div className="admin-dialog-footer">
					<Button label="Cancel" icon="pi pi-times" className="p-button-text p-button-secondary" onClick={hideAll} disabled={submitting} />
					<Button label="Reset Password" icon="pi pi-check" className="admin-save-btn" onClick={handleResetPassword} loading={submitting} />
				</div>
			</Dialog>

			{/* ── Delete Confirm Dialog ────────────────────────────────── */}
			<Dialog
				visible={delDialog}
				style={{ width: "440px" }}
				header={
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.18)", fontSize: "1.2rem" }}>
							<i className="pi pi-trash" style={{ color: "#fff" }} />
						</span>
						<span style={{ color: "#fff", fontWeight: 900 }}>Confirm Permanent Delete</span>
					</div>
				}
				modal
				className="admin-dialog"
				onHide={hideAll}
			>
				<div className="admin-confirm-box">
					<i className="pi pi-exclamation-triangle" />
					<div>
						<strong>This action cannot be undone.</strong>
						<p>The user <b>{selectedUser?.Name}</b> ({selectedUser?.Emp_id}) will be permanently removed from Active Directory.</p>
					</div>
				</div>
				<div className="admin-dialog-footer">
					<Button label="Cancel — Keep User" icon="pi pi-times" className="p-button-text p-button-secondary" onClick={hideAll} disabled={submitting} />
					<Button label="Delete Permanently" icon="pi pi-trash" className="admin-confirm-danger" onClick={handleDeleteUser} loading={submitting} />
				</div>
			</Dialog>

			{/* ── Unlock Account Dialog ─────────────────────────────────── */}
			<Dialog
				visible={unlockDialog}
				style={{ width: "440px" }}
				header={
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.18)", fontSize: "1.2rem" }}>
							<i className="pi pi-lock-open" style={{ color: "#fff" }} />
						</span>
						<span style={{ color: "#fff", fontWeight: 900 }}>Unlock Account</span>
					</div>
				}
				modal
				className="admin-dialog"
				onHide={hideAll}
			>
				<div className="admin-confirm-box" style={{ background: "rgba(251,191,36,0.07)", borderColor: "rgba(251,191,36,0.25)", marginBottom: "1.25rem" }}>
					<i className="pi pi-lock" style={{ fontSize: "1.4rem", color: "#d97706" }} />
					<div>
						<strong>{selectedUser?.Name}</strong>
						<p>ID: <code>{selectedUser?.Emp_id}</code> &nbsp;·&nbsp; {selectedUser?.Department}</p>
						<p style={{ marginTop: "6px", fontSize: "0.82rem", color: "#92400e" }}>
							This account is currently <b>locked out</b> due to repeated failed login attempts.
							Clicking <b>Unlock</b> will immediately clear the lockout and allow the user to log in again.
						</p>
					</div>
				</div>
				<div className="admin-dialog-footer">
					<Button label="Cancel" icon="pi pi-times" className="p-button-text p-button-secondary" onClick={hideAll} disabled={submitting} />
					<Button
						label="Unlock Account"
						icon="pi pi-lock-open"
						className="admin-save-btn"
						style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", borderColor: "#d97706" }}
						onClick={handleUnlockUser}
						loading={submitting}
					/>
				</div>
			</Dialog>

			{/* ── User Detail Panel ──────────────────────────────────── */}
			<Dialog
				visible={detailDialog}
				style={{ width: "560px" }}
				header={
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.18)", fontSize: "1.2rem" }}>
							<i className="pi pi-id-card" style={{ color: "#fff" }} />
						</span>
						<span style={{ color: "#fff", fontWeight: 900 }}>Full Profile — {selectedUser?.Name}</span>
					</div>
				}
				modal
				className="admin-dialog"
				onHide={hideAll}
			>
				{detailLoading && <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}><i className="pi pi-spin pi-spinner" style={{ fontSize: "2rem" }} /></div>}
				{detailData?.error && <div style={{ padding: "20px", color: "#dc2626" }}>Error: {detailData.error}</div>}
				{detailData && !detailData.error && (
					<div className="admin-detail-grid">
						{[
							["Employee ID", detailData.Emp_id, "pi-id-badge"],
							["Full Name", detailData.Name, "pi-user"],
							["Department", detailData.Department, "pi-building"],
							["Job Title", detailData.Title || "—", "pi-briefcase"],
							["Email", detailData.Mail || "—", "pi-envelope"],
							["Phone", detailData.Mobile || "—", "pi-phone"],
							["Account Status", detailData.Status + (detailData.Locked ? " (Locked)" : ""), "pi-shield"],
							["Pwd Expiry", detailData.PwdExpiry !== null && detailData.PwdExpiry !== undefined ? `${detailData.PwdExpiry} day(s)` : (detailData.NeverExpires ? "Never Expires" : "Unknown"), "pi-clock"],
							["Pwd Last Set", detailData.PwdLastSet || "—", "pi-key"],
							["Must Change Pwd", detailData.MustChangePwd ? "Yes — at next login" : "No", "pi-refresh"],
							["Failed Login Attempts", detailData.BadPwdCount || "0", "pi-times-circle"],
							["Last Bad Pwd Time", detailData.BadPwdTime || "—", "pi-calendar-times"],
							["Last Logon", detailData.LastLogon || "Never recorded", "pi-sign-in"],
							["Account Created", detailData.WhenCreated || "—", "pi-plus-circle"],
							["Description", detailData.Description || "—", "pi-info-circle"],
						].map(([label, val, icon]) => (
							<div key={label} className="admin-detail-row">
								<span className="admin-detail-label"><i className={`pi ${icon}`} />&nbsp;{label}</span>
								<span className="admin-detail-val">{val}</span>
							</div>
						))}
						{detailData.Groups?.length > 0 && (
							<div className="admin-detail-row admin-detail-row--full">
								<span className="admin-detail-label"><i className="pi pi-users" />&nbsp;AD Groups</span>
								<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
									{detailData.Groups.map(g => <span key={g} className="admin-dept-badge">{g}</span>)}
								</div>
							</div>
						)}
					</div>
				)}
				<div className="admin-dialog-footer">
					<Button label="Edit User" icon="pi pi-pencil" className="admin-save-btn" onClick={() => { hideAll(); openEditUser(selectedUser); }} />
					<Button label="Close" icon="pi pi-times" className="p-button-text p-button-secondary" onClick={hideAll} />
				</div>
			</Dialog>

			{/* ── Force Password Change Dialog ───────────────────────── */}
			<Dialog
				visible={forceChangeDialog}
				style={{ width: "420px" }}
				header={<div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.18)", fontSize: "1.2rem" }}><i className="pi pi-refresh" style={{ color: "#fff" }} /></span><span style={{ color: "#fff", fontWeight: 900 }}>Force Password Change</span></div>}
				modal className="admin-dialog" onHide={hideAll}
			>
				<div className="admin-confirm-box" style={{ background: "rgba(234,88,12,0.07)", borderColor: "rgba(234,88,12,0.25)" }}>
					<i className="pi pi-exclamation-triangle" style={{ color: "#ea580c" }} />
					<div>
						<strong>{selectedUser?.Name}</strong>
						<p>The user will be required to change their password the next time they log in. Their current session will not be interrupted.</p>
					</div>
				</div>
				<div className="admin-dialog-footer">
					<Button label="Cancel" icon="pi pi-times" className="p-button-text p-button-secondary" onClick={hideAll} disabled={submitting} />
					<Button label="Force Change" icon="pi pi-refresh" className="admin-save-btn" style={{ background: "linear-gradient(135deg,#ea580c,#c2410c)" }} onClick={handleForcePasswordChange} loading={submitting} />
				</div>
			</Dialog>

			{/* ── Send Reset OTP Dialog ──────────────────────────────── */}
			<Dialog
				visible={sendOtpDialog}
				style={{ width: "420px" }}
				header={<div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.18)", fontSize: "1.2rem" }}><i className="pi pi-envelope" style={{ color: "#fff" }} /></span><span style={{ color: "#fff", fontWeight: 900 }}>Send Password Reset OTP</span></div>}
				modal className="admin-dialog" onHide={hideAll}
			>
				{!otpResult ? (
					<>
						<div className="admin-confirm-box" style={{ background: "rgba(16,185,129,0.07)", borderColor: "rgba(16,185,129,0.25)" }}>
							<i className="pi pi-send" style={{ color: "#059669" }} />
							<div>
								<strong>{selectedUser?.Name} ({selectedUser?.Emp_id})</strong>
								<p>An OTP email will be sent to the user's registered address so they can reset their own password.</p>
							</div>
						</div>
						<div className="admin-dialog-footer">
							<Button label="Cancel" icon="pi pi-times" className="p-button-text p-button-secondary" onClick={hideAll} disabled={submitting} />
							<Button label="Send OTP Email" icon="pi pi-send" className="admin-save-btn" style={{ background: "linear-gradient(135deg,#059669,#047857)" }} onClick={handleSendResetOtp} loading={submitting} />
						</div>
					</>
				) : (
					<>
						<div className="admin-confirm-box" style={{ background: "rgba(16,185,129,0.09)", borderColor: "rgba(16,185,129,0.28)" }}>
							<i className="pi pi-check-circle" style={{ color: "#059669", fontSize: "1.8rem" }} />
							<div>
								<strong>OTP Sent Successfully</strong>
								<p>Email sent to: <b>{otpResult.masked_email}</b></p>
								{otpResult.is_fallback && <p style={{ color: "#d97706", marginTop: 4 }}>⚠ No email on file — sent to IT helpdesk instead.</p>}
								<p style={{ marginTop: 4 }}>Expires in: {Math.floor(otpResult.expires_in / 60)} minutes</p>
							</div>
						</div>
						<div className="admin-dialog-footer">
							<Button label="Done" icon="pi pi-check" className="admin-save-btn" onClick={hideAll} />
						</div>
					</>
				)}
			</Dialog>
		</main>
	);
}
