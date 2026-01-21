import { useState, useEffect } from 'react';
import {
    Users as UsersIcon,
    Plus,
    Search,
    Edit2,
    Trash2,
    Shield,
    ShieldOff,
    Check,
    X,
    Server,
    Clock,
    Globe,
    Palette,
    Key,
    User as UserIcon
} from 'lucide-react';
import Select from '../components/Select';

interface User {
    id: string;
    username: string;
    role: 'admin' | 'user';
    is_active: boolean;
    language: string;
    accent_color: string;
    created_at: string;
    updated_at: string;
    last_login: string | null;
    last_ip: string | null;
    allocated_servers: string[];
}

interface ServerInfo {
    id: string;
    name: string;
}

const LANGUAGES = [
    { code: 'fr', name: 'Français' },
    { code: 'en', name: 'English' },
];

const PRESET_COLORS = [
    '#FF591E', // Mistral Orange
    '#6366F1', // Indigo
    '#ec4899', // Pink
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#F59E0B', // Amber
];

import { useLanguage } from '../contexts/LanguageContext';

export default function Users() {
    const { t } = useLanguage();
    const [users, setUsers] = useState<User[]>([]);
    const [servers, setServers] = useState<ServerInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'user' as 'admin' | 'user',
        is_active: true,
        language: 'fr',
        accent_color: '#3A82F6',
        allocated_servers: [] as string[]
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [usersRes, serversRes] = await Promise.all([
                fetch('/api/v1/users', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                }),
                fetch('/api/v1/servers', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                })
            ]);

            if (usersRes.ok) {
                const usersData = await usersRes.json();
                setUsers(usersData);
            }

            if (serversRes.ok) {
                const serversData = await serversRes.json();
                setServers(serversData);
            }
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const openModal = (user?: User) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                username: user.username,
                password: '',
                role: user.role,
                is_active: user.is_active,
                language: user.language,
                accent_color: user.accent_color,
                allocated_servers: user.allocated_servers || []
            });
        } else {
            setEditingUser(null);
            setFormData({
                username: '',
                password: '',
                role: 'user',
                is_active: true,
                language: 'fr',
                accent_color: '#3A82F6',
                allocated_servers: []
            });
        }
        setError('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSaving(true);

        try {
            const url = editingUser
                ? `/api/v1/users/${editingUser.id}`
                : '/api/v1/users';
            const method = editingUser ? 'PUT' : 'POST';

            const body: Record<string, unknown> = {
                username: formData.username,
                role: formData.role,
                is_active: formData.is_active,
                language: formData.language,
                accent_color: formData.accent_color,
                allocated_servers: formData.allocated_servers
            };

            if (formData.password) {
                body.password = formData.password;
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                closeModal();
                fetchData();
            } else {
                const data = await response.json();
                setError(data.error || 'Une erreur est survenue');
            }
        } catch (error) {
            setError('Erreur de connexion au serveur');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (user: User) => {
        if (!confirm(t('common.delete') + ` "${user.username}" ?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/users/${user.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });

            if (response.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
        }
    };

    const handleToggleActive = async (user: User) => {
        try {
            const response = await fetch(`/api/v1/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    is_active: !user.is_active
                }),
            });

            if (response.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const toggleServerAllocation = (serverId: string) => {
        setFormData(prev => ({
            ...prev,
            allocated_servers: prev.allocated_servers.includes(serverId)
                ? prev.allocated_servers.filter(id => id !== serverId)
                : [...prev.allocated_servers, serverId]
        }));
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Jamais';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p className="text-muted">{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header__title">{t('users.title')}</h1>
                    <p className="page-header__subtitle">{t('users.subtitle')}</p>
                </div>
                <div className="page-header__actions">
                    <button className="btn btn--primary" onClick={() => openModal()}>
                        <Plus size={18} />
                        {t('users.create_user')}
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="search-bar" style={{ marginBottom: '1.5rem' }}>
                <Search size={18} className="search-bar__icon" />
                <input
                    type="text"
                    placeholder={t('common.search')}
                    className="form-input search-bar__input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Users Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{t('users.username')}</th>
                                <th>{t('users.role')}</th>
                                <th>{t('server_detail.status')}</th>
                                <th>{t('users.last_login')}</th>
                                <th>Dernière IP</th>
                                <th>{t('backups.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="table__empty">
                                        <UsersIcon size={24} />
                                        <span>Aucun utilisateur trouvé</span>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className={!user.is_active ? 'table__row--disabled' : ''}>
                                        <td>
                                            <div className="user-cell">
                                                <div
                                                    className="user-cell__avatar"
                                                    style={{ backgroundColor: user.accent_color }}
                                                >
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="user-cell__info">
                                                    <span className="user-cell__name">{user.username}</span>
                                                    <span className="user-cell__created">
                                                        Créé le {formatDate(user.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge badge--${user.role === 'admin' ? 'primary' : 'secondary'}`}>
                                                {user.role === 'admin' ? (
                                                    <><Shield size={12} /> Admin</>
                                                ) : (
                                                    <><UserIcon size={12} /> User</>
                                                )}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge badge--${user.is_active ? 'success' : 'danger'}`}>
                                                {user.is_active ? 'Actif' : 'Désactivé'}
                                            </span>
                                        </td>
                                        <td className="text-muted">
                                            {formatDate(user.last_login)}
                                        </td>
                                        <td className="text-mono text-muted">
                                            {user.last_ip || '—'}
                                        </td>
                                        <td>
                                            <div className="table__actions">
                                                <button
                                                    className="btn btn--icon btn--ghost"
                                                    onClick={() => handleToggleActive(user)}
                                                    title={user.is_active ? 'Désactiver' : 'Activer'}
                                                >
                                                    {user.is_active ? <ShieldOff size={16} /> : <Shield size={16} />}
                                                </button>
                                                <button
                                                    className="btn btn--icon btn--ghost"
                                                    onClick={() => openModal(user)}
                                                    title="Modifier"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn btn--icon btn--ghost btn--danger"
                                                    onClick={() => handleDelete(user)}
                                                    title="Supprimer"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">
                                {editingUser ? t('users.edit_user') : t('users.create_user')}
                            </h2>
                            <button className="modal__close" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal__body">
                                {error && (
                                    <div className="alert alert--error" style={{ marginBottom: '1rem' }}>
                                        {error}
                                    </div>
                                )}

                                <div className="form-grid form-grid--2col">
                                    <div className="form-group">
                                        <label className="form-label">
                                            <UserIcon size={14} style={{ marginRight: '0.5rem' }} />
                                            {t('users.username')}
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.username}
                                            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">
                                            <Key size={14} style={{ marginRight: '0.5rem' }} />
                                            {editingUser ? t('user_settings.new_password') : t('auth.password')}
                                        </label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            placeholder={editingUser ? t('users.password_placeholder') : ''}
                                            value={formData.password}
                                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                            required={!editingUser}
                                        />
                                    </div>
                                </div>

                                <div className="form-grid form-grid--2col">
                                    <div className="form-group">
                                        <label className="form-label">
                                            <Shield size={14} style={{ marginRight: '0.5rem' }} />
                                            {t('users.role')}
                                        </label>
                                        <Select
                                            options={[
                                                { label: t('user_settings.role_user'), value: 'user', icon: <UserIcon size={14} /> },
                                                { label: t('user_settings.role_admin'), value: 'admin', icon: <Shield size={14} /> }
                                            ]}
                                            value={formData.role}
                                            onChange={(value) => setFormData(prev => ({ ...prev, role: value as 'admin' | 'user' }))}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">
                                            <Globe size={14} style={{ marginRight: '0.5rem' }} />
                                            {t('settings.language')}
                                        </label>
                                        <Select
                                            options={LANGUAGES.map(lang => ({
                                                label: lang.name,
                                                value: lang.code
                                            }))}
                                            value={formData.language}
                                            onChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        <Palette size={14} style={{ marginRight: '0.5rem' }} />
                                        {t('user_settings.accent_color')}
                                    </label>
                                    <div className="color-picker">
                                        {PRESET_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, accent_color: color }))}
                                                className={`color-picker__swatch ${formData.accent_color.toLowerCase() === color.toLowerCase() ? 'color-picker__swatch--active' : ''}`}
                                                style={{
                                                    background: color,
                                                    boxShadow: formData.accent_color.toLowerCase() === color.toLowerCase()
                                                        ? `0 0 15px ${color}66`
                                                        : 'none'
                                                }}
                                            >
                                                {formData.accent_color.toLowerCase() === color.toLowerCase() && (
                                                    <Check size={16} color="white" strokeWidth={3} />
                                                )}
                                            </button>
                                        ))}
                                        <div className="color-picker__custom">
                                            <input
                                                type="color"
                                                value={formData.accent_color}
                                                onChange={(e) => setFormData(prev => ({ ...prev, accent_color: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        <Server size={14} style={{ marginRight: '0.5rem' }} />
                                        Serveurs alloués
                                    </label>
                                    {servers.length === 0 ? (
                                        <p className="form-hint">Aucun serveur disponible</p>
                                    ) : (
                                        <div className="server-allocation">
                                            {servers.map(server => (
                                                <button
                                                    key={server.id}
                                                    type="button"
                                                    className={`server-allocation__item ${formData.allocated_servers.includes(server.id) ? 'server-allocation__item--active' : ''}`}
                                                    onClick={() => toggleServerAllocation(server.id)}
                                                >
                                                    {formData.allocated_servers.includes(server.id) && (
                                                        <Check size={14} />
                                                    )}
                                                    {server.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                        />
                                        <span className="form-checkbox__mark"></span>
                                        Compte actif
                                    </label>
                                </div>

                                {editingUser && (
                                    <div className="user-info-grid">
                                        <div className="user-info-item">
                                            <Clock size={14} />
                                            <span className="user-info-item__label">Créé le</span>
                                            <span className="user-info-item__value">{formatDate(editingUser.created_at)}</span>
                                        </div>
                                        <div className="user-info-item">
                                            <Clock size={14} />
                                            <span className="user-info-item__label">Modifié le</span>
                                            <span className="user-info-item__value">{formatDate(editingUser.updated_at)}</span>
                                        </div>
                                        <div className="user-info-item">
                                            <Clock size={14} />
                                            <span className="user-info-item__label">Dernière connexion</span>
                                            <span className="user-info-item__value">{formatDate(editingUser.last_login)}</span>
                                        </div>
                                        <div className="user-info-item">
                                            <Globe size={14} />
                                            <span className="user-info-item__label">Dernière IP</span>
                                            <span className="user-info-item__value text-mono">{editingUser.last_ip || '—'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal__footer">
                                <button type="button" className="btn btn--secondary" onClick={closeModal}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="btn btn--primary" disabled={isSaving}>
                                    {isSaving ? t('common.loading') : (editingUser ? t('common.save') : t('common.create'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
