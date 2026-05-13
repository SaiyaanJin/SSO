import React, { useState, useEffect, useCallback, useRef } from "react";
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
	const [userDialog,    setUserDialog]    = useState(false);
	const [pwdDialog,     setPwdDialog]     = useState(false);
	const [delDialog,     setDelDialog]     = useState(false);
	const [unlockDialog,  setUnlockDialog]  = useState(false);

	const [selectedUser, setSelectedUser] = useState(null);
	const [formData, setFormData]         = useState(EMPTY_FORM);
	const [isEdit, setIsEdit]             = useState(false);
	const [submitting, setSubmitting]     = useState(false);

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
		} catch (err) {
			if (err.response?.status === 401 || err.response?.status === 403) {
				navigate("/dashboard");
			}
		} finally {
			setLoading(false);
		}
	}, [getHeaders, navigate]);

	useEffect(() => { fetchUsers(); }, [fetchUsers]);

	// ── Filter ──────────────────────────────────────────────────────────
	const onGlobalFilterChange = (e) => {
		const value = e.target.value;
		setFilters(f => ({ ...f, global: { value, matchMode: FilterMatchMode.CONTAINS } }));
		setGlobalFilterValue(value);
	};

	// ── Dialog helpers ──────────────────────────────────────────────────
	const hideAll = () => {
		setUserDialog(false); setPwdDialog(false); setDelDialog(false); setUnlockDialog(false);
		setSelectedUser(null); setFormData(EMPTY_FORM); setSubmitting(false);
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
			} else {
				await axios.post(`${API_BASE}/admin/users`, formData, getHeaders());
			}
			hideAll(); fetchUsers();
		} catch (err) {
			alert("Error: " + (err.response?.data?.error || err.message));
			setSubmitting(false);
		}
	};

	const handleDeleteUser = async () => {
		setSubmitting(true);
		try {
			await axios.delete(`${API_BASE}/admin/users/${selectedUser.Emp_id}`, getHeaders());
			hideAll(); fetchUsers();
		} catch (err) {
			alert("Error: " + (err.response?.data?.error || err.message));
			setSubmitting(false);
		}
	};

	const handleResetPassword = async () => {
		setSubmitting(true);
		try {
			await axios.post(`${API_BASE}/admin/users/${selectedUser.Emp_id}/reset-password`, { password: formData.password }, getHeaders());
			alert("Password reset successfully.");
			hideAll();
		} catch (err) {
			alert("Error: " + (err.response?.data?.error || err.message));
			setSubmitting(false);
		}
	};

	const toggleStatus = async (user) => {
		const enable = user.Status === "Disabled";
		try {
			await axios.post(`${API_BASE}/admin/users/${user.Emp_id}/toggle-status`, { enable }, getHeaders());
			fetchUsers();
		} catch (err) {
			alert("Error: " + (err.response?.data?.error || err.message));
		}
	};

	const handleUnlockUser = async () => {
		setSubmitting(true);
		try {
			await axios.post(`${API_BASE}/admin/users/${selectedUser.Emp_id}/unlock`, {}, getHeaders());
			alert(`Account for ${selectedUser.Name} has been unlocked successfully.`);
			hideAll(); fetchUsers();
		} catch (err) {
			alert("Error: " + (err.response?.data?.error || err.message));
			setSubmitting(false);
		}
	};

	// ── Derived stats ────────────────────────────────────────────────────
	const totalUsers    = users.length;
	const activeUsers   = users.filter(u => u.Status === "Active").length;
	const disabledUsers = users.filter(u => u.Status === "Disabled").length;
	const lockedUsers   = users.filter(u => u.Locked).length;

	// ── Cell templates ───────────────────────────────────────────────────
	const rowNumBody = (_, opts) => (
		<span className="admin-row-num">{opts.rowIndex + 1}</span>
	);

	const nameBody = (rowData) => (
		<span className="admin-name-cell">
			<i className="pi pi-user" />
			{rowData.Name}
		</span>
	);

	const empidBody = (rowData) => (
		<code className="admin-empid">{rowData.Emp_id}</code>
	);

	const deptBody = (rowData) => (
		<span className="admin-dept-badge">{rowData.Department}</span>
	);

	const mailBody = (rowData) => (
		<a href={`mailto:${rowData.Mail}`} className="admin-mail-link">
			<i className="pi pi-envelope" />
			{rowData.Mail}
		</a>
	);

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

	// ── Per-row action menu ───────────────────────────────────────────────
	const actionMenuRef = useRef(null);
	const [actionMenuRow, setActionMenuRow] = useState(null);

	const buildMenuItems = (row) => {
		if (!row) return [];
		const isActive = row.Status === "Active";
		const items = [
			{
				label: "Edit User Details",
				icon: "pi pi-pencil",
				command: () => openEditUser(row),
			},
			{
				label: "Reset Password",
				icon: "pi pi-key",
				command: () => openResetPwd(row),
			},
			{ separator: true },
		];
		if (row.Locked) {
			items.push({
				label: "Unlock Account",
				icon: "pi pi-lock-open",
				className: "action-menu-unlock",
				command: () => openUnlockDialog(row),
			});
		}
		items.push(
			{
				label: isActive ? "Disable Account" : "Enable Account",
				icon: isActive ? "pi pi-ban" : "pi pi-check-circle",
				className: isActive ? "action-menu-disable" : "action-menu-enable",
				command: () => toggleStatus(row),
			},
			{ separator: true },
			{
				label: "Delete User",
				icon: "pi pi-trash",
				className: "action-menu-delete",
				command: () => openDelDialog(row),
			}
		);
		return items;
	};

	const actionBody = (rowData) => (
		<div className="action-cell">
			<Menu
				model={actionMenuRow?.Emp_id === rowData.Emp_id ? buildMenuItems(actionMenuRow) : []}
				popup
				ref={actionMenuRef}
				appendTo={document.body}
				className="admin-action-menu"
			/>
			<Button
				label="Actions"
				icon="pi pi-chevron-down"
				iconPos="right"
				className="admin-action-trigger"
				onClick={(e) => {
					setActionMenuRow(rowData);
					// Give React one tick to update actionMenuRow so model is fresh
					setTimeout(() => actionMenuRef.current?.toggle(e), 0);
				}}
			/>
		</div>
	);

	// ── Table toolbar ─────────────────────────────────────────────────────
	const tableHeader = (
		<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(220,38,38,0.10)", background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)" }}>
			<Button
				label="Add New User"
				icon="pi pi-user-plus"
				className="admin-add-btn"
				onClick={openNewUser}
			/>
			<span className="admin-search">
				<i className="pi pi-search" style={{ color: "#94a3b8" }} />
				<InputText
					value={globalFilterValue}
					onChange={onGlobalFilterChange}
					placeholder="Search by name, ID, department, email…"
					className="admin-search-input"
				/>
			</span>
		</div>
	);

	return (
		<main className="admin-shell">
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
					<div className="admin-hero-stat">
						<span>{loading ? "—" : totalUsers}</span>
						<p>Total Accounts</p>
					</div>
					<div className="admin-hero-stat">
						<span style={{ color: "#86efac" }}>{loading ? "—" : activeUsers}</span>
						<p>Active</p>
					</div>
					<div className="admin-hero-stat">
						<span style={{ color: "#fca5a5" }}>{loading ? "—" : disabledUsers}</span>
						<p>Disabled</p>
					</div>
					<div className="admin-hero-stat">
						<span style={{ color: "#fbbf24" }}>{loading ? "—" : lockedUsers}</span>
						<p>Locked Out</p>
					</div>
				</div>
			</section>

			{/* ── Workspace ────────────────────────────────────────────── */}
			<section className="admin-workspace">
				<div className="admin-section-heading">
					<div>
						<p>Restricted — IT Department Only</p>
						<h2>User Directory</h2>
					</div>
					<span>{loading ? "" : `${totalUsers} accounts`}</span>
				</div>

				<DataTable
					value={users}
					loading={loading}
					filters={filters}
					globalFilterFields={["Name", "Emp_id", "Department", "Mail", "Mobile", "Status"]}
					header={tableHeader}
					emptyMessage={
						<div className="admin-empty">
							<i className="pi pi-search" />
							<p>No users match the search criteria.</p>
						</div>
					}
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
					<Column field="Status"     header="Status"          body={statusBody} sortable align="center" style={{ width: "10%" }} />
					<Column header="Actions"   body={actionBody}        align="center"    style={{ width: "130px", minWidth: "130px" }} />
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
		</main>
	);
}
