import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { FilterMatchMode } from "primereact/api";
import GILogo from "./staticFiles/GILogo.png";
import "./AdminConsole.css";

const DEPARTMENTS = [
    { label: "Information Technology (IT)", value: "IT" },
    { label: "Market Operation (MO)", value: "MO" },
    { label: "System Operation (SO)", value: "SO" },
    { label: "Control Room (CR)", value: "CR" },
    { label: "SCADA", value: "SCADA" },
    { label: "Contracts & Services (CS)", value: "CS" },
    { label: "Technical Services (TS)", value: "TS" },
    { label: "Human Resource (HR)", value: "HR" },
    { label: "Communication", value: "COMMUNICATION" },
    { label: "Finance & Accounts (F&A)", value: "F&A" }
];

export default function AdminConsole() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalFilterValue, setGlobalFilterValue] = useState("");
    const [filters, setFilters] = useState({
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    });

    // Dialog states
    const [userDialog, setUserDialog] = useState(false);
    const [pwdDialog, setPwdDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState({
        username: "",
        name: "",
        department: "",
        email: "",
        phone: "",
        password: ""
    });
    const [isEdit, setIsEdit] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const getHeaders = () => ({
        headers: { Token: localStorage.getItem("token") }
    });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get("https://sso.erldc.in:5000/admin/users", getHeaders());
            setUsers(res.data);
        } catch (err) {
            console.error("Failed to fetch users", err);
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                navigate("/dashboard");
            } else {
                alert("Error fetching users: " + (err.response?.data?.error || err.message));
            }
        } finally {
            setLoading(false);
        }
    };

    const onGlobalFilterChange = (e) => {
        const value = e.target.value;
        let _filters = { ...filters };
        _filters["global"].value = value;
        setFilters(_filters);
        setGlobalFilterValue(value);
    };

    const openNewUser = () => {
        setIsEdit(false);
        setFormData({ username: "", name: "", department: "", email: "", phone: "", password: "" });
        setUserDialog(true);
    };

    const editUser = (user) => {
        setIsEdit(true);
        setSelectedUser(user);
        // We only modify name, email, phone from UI for simplicity, though department could be mapped back
        setFormData({
            username: user.Emp_id,
            name: user.Name,
            email: user.Mail,
            phone: user.Mobile,
            department: "", // Skipping department change for edit
            password: ""
        });
        setUserDialog(true);
    };

    const confirmDeleteUser = (user) => {
        setSelectedUser(user);
        setDeleteDialog(true);
    };

    const openResetPassword = (user) => {
        setSelectedUser(user);
        setFormData({ ...formData, password: "" });
        setPwdDialog(true);
    };

    const hideDialogs = () => {
        setUserDialog(false);
        setPwdDialog(false);
        setDeleteDialog(false);
        setSelectedUser(null);
    };

    const handleSaveUser = async () => {
        try {
            if (isEdit) {
                await axios.put(`https://sso.erldc.in:5000/admin/users/${selectedUser.Emp_id}`, formData, getHeaders());
                alert("User modified successfully.");
            } else {
                await axios.post("https://sso.erldc.in:5000/admin/users", formData, getHeaders());
                alert("User created successfully.");
            }
            hideDialogs();
            fetchUsers();
        } catch (err) {
            alert("Error saving user: " + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteUser = async () => {
        try {
            await axios.delete(`https://sso.erldc.in:5000/admin/users/${selectedUser.Emp_id}`, getHeaders());
            alert("User deleted successfully.");
            hideDialogs();
            fetchUsers();
        } catch (err) {
            alert("Error deleting user: " + (err.response?.data?.error || err.message));
        }
    };

    const handleResetPassword = async () => {
        try {
            await axios.post(`https://sso.erldc.in:5000/admin/users/${selectedUser.Emp_id}/reset-password`, { password: formData.password }, getHeaders());
            alert("Password reset successfully.");
            hideDialogs();
        } catch (err) {
            alert("Error resetting password: " + (err.response?.data?.error || err.message));
        }
    };

    const toggleStatus = async (user) => {
        const enable = user.Status === "Disabled";
        try {
            await axios.post(`https://sso.erldc.in:5000/admin/users/${user.Emp_id}/toggle-status`, { enable }, getHeaders());
            alert(`User ${enable ? "enabled" : "disabled"} successfully.`);
            fetchUsers();
        } catch (err) {
            alert("Error toggling status: " + (err.response?.data?.error || err.message));
        }
    };

    const header = (
        <div className="admin-table-toolbar">
            <Button label="Add New User" icon="pi pi-plus" className="p-button-success" onClick={openNewUser} />
            <span className="admin-search-wrap">
                <i className="pi pi-search" />
                <InputText
                    value={globalFilterValue}
                    onChange={onGlobalFilterChange}
                    placeholder="Search users..."
                    className="admin-search-input"
                />
            </span>
        </div>
    );

    const statusBodyTemplate = (rowData) => {
        const isActive = rowData.Status === "Active";
        return (
            <span className={`status-badge ${isActive ? 'status-active' : 'status-disabled'}`}>
                {rowData.Status}
            </span>
        );
    };

    const actionBodyTemplate = (rowData) => {
        const isActive = rowData.Status === "Active";
        return (
            <div className="action-buttons">
                <Button icon="pi pi-pencil" className="p-button-rounded p-button-text action-btn" tooltip="Edit User" onClick={() => editUser(rowData)} />
                <Button icon="pi pi-key" className="p-button-rounded p-button-warning p-button-text action-btn" tooltip="Reset Password" onClick={() => openResetPassword(rowData)} />
                <Button icon={isActive ? "pi pi-lock" : "pi pi-unlock"} className={`p-button-rounded p-button-text action-btn ${isActive ? 'p-button-secondary' : 'p-button-success'}`} tooltip={isActive ? "Disable User" : "Enable User"} onClick={() => toggleStatus(rowData)} />
                <Button icon="pi pi-trash" className="p-button-rounded p-button-danger p-button-text action-btn" tooltip="Delete User" onClick={() => confirmDeleteUser(rowData)} />
            </div>
        );
    };

    return (
        <main className="admin-shell">
            <nav className="admin-nav" aria-label="Portal navigation">
                <div className="admin-nav__brand">
                    <img src={GILogo} alt="Grid India" />
                    <span>ERLDC SSO</span>
                    <span className="admin-nav__brand-subtitle">Admin Console</span>
                </div>
                <div className="admin-nav__actions">
                    <Button
                        className="p-button-text p-button-secondary"
                        icon="pi pi-arrow-left"
                        label="Back to Dashboard"
                        onClick={() => navigate("/dashboard")}
                    />
                </div>
            </nav>

            <section className="admin-content">
                <div className="admin-header">
                    <div>
                        <h1>Active Directory Management</h1>
                        <p>Manage user accounts, passwords, and access control.</p>
                    </div>
                </div>

                <div className="card">
                    <DataTable
                        value={users}
                        loading={loading}
                        filters={filters}
                        globalFilterFields={["Name", "Emp_id", "Department", "Mail", "Mobile", "Status"]}
                        header={header}
                        emptyMessage="No users found."
                        paginator
                        rows={15}
                        rowsPerPageOptions={[15, 30, 50]}
                        stripedRows
                        showGridlines
                        sortMode="multiple"
                    >
                        <Column field="Name" header="Name" sortable />
                        <Column field="Emp_id" header="Username" sortable />
                        <Column field="Department" header="Department" sortable body={(rowData) => <span className="dept-badge">{rowData.Department}</span>} />
                        <Column field="Mail" header="Email" sortable />
                        <Column field="Mobile" header="Phone" sortable />
                        <Column field="Status" header="Status" sortable body={statusBodyTemplate} align="center" />
                        <Column header="Actions" body={actionBodyTemplate} align="center" style={{ minWidth: '160px' }} />
                    </DataTable>
                </div>
            </section>

            {/* Create / Edit User Dialog */}
            <Dialog visible={userDialog} style={{ width: '450px' }} header={isEdit ? "Edit User Details" : "Create New User"} modal className="p-fluid" onHide={hideDialogs}>
                <div className="field">
                    <label htmlFor="name">Full Name</label>
                    <InputText id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required autoFocus />
                </div>
                <div className="field">
                    <label htmlFor="username">Username / ID</label>
                    <InputText id="username" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required disabled={isEdit} />
                </div>
                {!isEdit && (
                    <div className="field">
                        <label htmlFor="department">Department</label>
                        <Dropdown id="department" value={formData.department} options={DEPARTMENTS} onChange={(e) => setFormData({...formData, department: e.value})} placeholder="Select a Department" />
                    </div>
                )}
                <div className="field">
                    <label htmlFor="email">Email Address</label>
                    <InputText id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="field">
                    <label htmlFor="phone">Phone Number</label>
                    <InputText id="phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                {!isEdit && (
                    <div className="field">
                        <label htmlFor="password">Initial Password</label>
                        <InputText id="password" type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required />
                    </div>
                )}
                <div className="flex justify-content-end mt-4 gap-2">
                    <Button label="Cancel" icon="pi pi-times" className="p-button-text" onClick={hideDialogs} />
                    <Button label="Save" icon="pi pi-check" className="p-button-primary" onClick={handleSaveUser} />
                </div>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog visible={pwdDialog} style={{ width: '450px' }} header="Force Reset Password" modal className="p-fluid" onHide={hideDialogs}>
                <p>Resetting password for <strong>{selectedUser?.Name}</strong> ({selectedUser?.Emp_id})</p>
                <div className="field mt-4">
                    <label htmlFor="new_password">New Password</label>
                    <InputText id="new_password" type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required autoFocus />
                </div>
                <div className="flex justify-content-end mt-4 gap-2">
                    <Button label="Cancel" icon="pi pi-times" className="p-button-text" onClick={hideDialogs} />
                    <Button label="Reset Password" icon="pi pi-check" className="p-button-warning" onClick={handleResetPassword} />
                </div>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog visible={deleteDialog} style={{ width: '450px' }} header="Confirm Delete" modal onHide={hideDialogs}>
                <div className="flex align-items-center justify-content-center">
                    <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#dc2626' }} />
                    {selectedUser && (
                        <span>Are you sure you want to permanently delete <b>{selectedUser.Name}</b>?</span>
                    )}
                </div>
                <div className="flex justify-content-end mt-4 gap-2">
                    <Button label="No, Keep User" icon="pi pi-times" className="p-button-text" onClick={hideDialogs} />
                    <Button label="Yes, Delete" icon="pi pi-check" className="p-button-danger" onClick={handleDeleteUser} />
                </div>
            </Dialog>
        </main>
    );
}
