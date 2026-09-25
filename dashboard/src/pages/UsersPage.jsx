import React, { useState } from 'react';
import {
  Users, Plus, Trash2, Edit3, Save, X,
  Search, HardHat, ShieldCheck, Siren, Settings2,
  Filter, UserCheck, UserX,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const ROLE_META = {
  miner:      { label: 'Miner',       Icon: HardHat,     color: 'text-mine-accent',  badge: 'badge-info'   },
  supervisor: { label: 'Supervisor',  Icon: ShieldCheck,  color: 'text-mine-blue',    badge: 'badge-info'   },
  rescue:     { label: 'Rescue',      Icon: Siren,        color: 'text-red-400',      badge: 'badge-danger' },
  admin:      { label: 'Admin',       Icon: Settings2,    color: 'text-mine-purple',  badge: 'badge-warn'   },
};

const SHIFTS   = ['Morning', 'Evening', 'Night', 'On-Call', 'All'];
const SECTIONS = ['SEC-A', 'SEC-B', 'SEC-C', 'ALL'];
const ROLES    = ['miner', 'supervisor', 'rescue', 'admin'];
const BLANK_USER = { name:'', username:'', password:'', role:'miner', badge:'', shift:'Morning', section:'SEC-A', phone:'', avatar:'👷', nodeId:'' };

export default function UsersPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const users       = useAuthStore(s => s.users);
  const addUser     = useAuthStore(s => s.addUser);
  const updateUser  = useAuthStore(s => s.updateUser);
  const deleteUser  = useAuthStore(s => s.deleteUser);

  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingId,  setEditingId]  = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [showAdd,    setShowAdd]    = useState(false);
  const [newUser,    setNewUser]    = useState({ ...BLANK_USER });
  const [confirmDel, setConfirmDel] = useState(null);

  // Only admin can access
  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-mine-muted">
        <UserX className="w-12 h-12 opacity-30" />
        <p className="text-lg font-semibold">Admin Access Required</p>
        <p className="text-sm">This page is restricted to administrators.</p>
      </div>
    );
  }

  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase())
      || u.username.toLowerCase().includes(search.toLowerCase())
      || u.badge.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  function startEdit(user) {
    setEditingId(user.id);
    setEditForm({ ...user, password: '' });
    setShowAdd(false);
  }

  function saveEdit() {
    const updates = { ...editForm };
    if (!updates.password) delete updates.password;
    updateUser(editingId, updates);
    setEditingId(null);
  }

  function handleAdd() {
    if (!newUser.name || !newUser.username || !newUser.password) return;
    addUser({ ...newUser, nodeId: newUser.nodeId ? parseInt(newUser.nodeId) : null });
    setNewUser({ ...BLANK_USER });
    setShowAdd(false);
  }

  const roleCountMap = ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {});

  return (
    <div className="p-4 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">User Management</h1>
          <span className="badge-info">{users.length} total</span>
        </div>
        <button onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {ROLES.map(r => {
          const m = ROLE_META[r];
          return (
            <div key={r} className="card flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-mine-deeper flex items-center justify-center">
                <m.Icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div>
                <div className="metric-label">{m.label}s</div>
                <div className={`text-xl font-black ${m.color}`}>{roleCountMap[r]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add user form */}
      {showAdd && (
        <div className="card border border-mine-accent/30 animate-slide-up">
          <div className="section-title mb-4">
            <Plus className="w-3.5 h-3.5 text-mine-accent" /> Add New User
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key:'name',     label:'Full Name',    type:'text',     placeholder:'Ramesh Kumar' },
              { key:'username', label:'Username',     type:'text',     placeholder:'ramesh.kumar' },
              { key:'password', label:'Password',     type:'password', placeholder:'Min 6 chars'  },
              { key:'phone',    label:'Phone',        type:'text',     placeholder:'+91 ...'       },
              { key:'badge',    label:'Badge ID',     type:'text',     placeholder:'MN-006'        },
              { key:'nodeId',   label:'Node ID (1-5)',type:'number',   placeholder:'Optional'      },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="metric-label mb-1.5 block">{label}</label>
                <input className="input-dark" type={type} placeholder={placeholder}
                  value={newUser[key]} onChange={e => setNewUser(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="metric-label mb-1.5 block">Role</label>
              <select className="input-dark" value={newUser.role} onChange={e => setNewUser(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
              </select>
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Shift</label>
              <select className="input-dark" value={newUser.shift} onChange={e => setNewUser(f => ({ ...f, shift: e.target.value }))}>
                {SHIFTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Section</label>
              <select className="input-dark" value={newUser.section} onChange={e => setNewUser(f => ({ ...f, section: e.target.value }))}>
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> Create User
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mine-muted" />
          <input className="input-dark pl-10" placeholder="Search by name, username or badge…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-mine-muted mr-1" />
          {['all', ...ROLES].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${roleFilter === r ? 'bg-mine-accent text-mine-bg' : 'btn-ghost'}`}>
              {r === 'all' ? 'All' : ROLE_META[r].label}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="card p-0 overflow-hidden">
        <table className="table-dark">
          <thead>
            <tr>
              {['User', 'Role', 'Badge', 'Shift', 'Section', 'Phone', 'Joined', 'Actions'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => {
              const m = ROLE_META[user.role] || ROLE_META.miner;
              const isEditing = editingId === user.id;
              return (
                <tr key={user.id} className={isEditing ? 'bg-mine-panel/60' : ''}>
                  {isEditing ? (
                    <>
                      <td colSpan={7} className="py-3 px-3">
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {[
                            { key:'name',    label:'Name',    type:'text'    },
                            { key:'phone',   label:'Phone',   type:'text'    },
                            { key:'badge',   label:'Badge',   type:'text'    },
                            { key:'password',label:'New Password',type:'password'},
                          ].map(({ key, label, type }) => (
                            <div key={key}>
                              <div className="metric-label mb-1">{label}</div>
                              <input className="input-dark text-xs py-1.5" type={type}
                                value={editForm[key] || ''}
                                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
                            </div>
                          ))}
                          <div>
                            <div className="metric-label mb-1">Shift</div>
                            <select className="input-dark text-xs py-1.5" value={editForm.shift || ''}
                              onChange={e => setEditForm(f => ({ ...f, shift: e.target.value }))}>
                              {SHIFTS.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="metric-label mb-1">Section</div>
                            <select className="input-dark text-xs py-1.5" value={editForm.section || ''}
                              onChange={e => setEditForm(f => ({ ...f, section: e.target.value }))}>
                              {SECTIONS.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="text-green-400 hover:text-green-300 transition-colors" title="Save">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-mine-muted hover:text-mine-dim transition-colors" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{user.avatar}</span>
                          <div>
                            <div className="text-mine-text font-semibold text-xs">{user.name}</div>
                            <div className="text-mine-muted text-[10px] font-mono">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`flex items-center gap-1 text-xs font-semibold ${m.color}`}>
                          <m.Icon className="w-3 h-3" />{m.label}
                        </span>
                      </td>
                      <td><span className="badge-info">{user.badge}</span></td>
                      <td>{user.shift}</td>
                      <td>{user.section}</td>
                      <td className="font-mono text-xs">{user.phone || '—'}</td>
                      <td className="font-mono text-xs">{user.joined}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(user)}
                            className="text-mine-muted hover:text-mine-accent transition-colors" title="Edit">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {user.id !== currentUser.id && (
                            confirmDel === user.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => { deleteUser(user.id); setConfirmDel(null); }}
                                  className="text-red-400 hover:text-red-300 text-[10px] font-bold px-1.5 py-0.5 bg-red-900/30 rounded">
                                  Confirm
                                </button>
                                <button onClick={() => setConfirmDel(null)}
                                  className="text-mine-muted text-[10px] px-1.5 py-0.5">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDel(user.id)}
                                className="text-mine-muted hover:text-red-400 transition-colors" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-mine-muted">No users match your filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
