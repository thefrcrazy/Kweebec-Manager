import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    User as UserIcon,
    Key,
    Shield,
    Globe,
    Palette,
    Server,
    Clock,
    Check,
    Save
} from 'lucide-react';
import Select from '../components/Select';
import Checkbox from '../components/Checkbox';
import { useLanguage } from '../contexts/LanguageContext';
import { usePageTitle } from '../contexts/PageTitleContext';

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

export default function EditUser() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const isCreating = id === 'new';

    const [user, setUser] = useState<User | null>(null);
    const [servers, setServers] = useState<ServerInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'user' as 'admin' | 'user',
        is_active: true,
        language: 'fr',
        accent_color: '#3A82F6',
        allocated_servers: [] as string[]
    });

    useEffect(() => {
        fetchData();
    }, [id]);

    const { setPageTitle } = usePageTitle();
    useEffect(() => {
        const title = isCreating ? t('users.create_user') : t('users.edit_user');
        const subtitle = isCreating ? 'Créez un nouveau compte utilisateur' : `Modifier le compte de ${user?.username || ''}`;
        setPageTitle(title, subtitle, { to: '/panel-settings?tab=users' });
    }, [setPageTitle, t, isCreating, user]);

    const fetchData = async () => {
        try {
            const serversRes = await fetch('/api/v1/servers', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (serversRes.ok) {
                setServers(await serversRes.json());
            }

            if (!isCreating && id) {
                const userRes = await fetch(`/api/v1/users/${id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                if (userRes.ok) {
                    const userData = await userRes.json();
                    setUser(userData);
                    setFormData({
                        username: userData.username,
                        password: '',
                        role: userData.role,
                        is_active: userData.is_active,
                        language: userData.language,
                        accent_color: userData.accent_color,
                        allocated_servers: userData.allocated_servers || []
                    });
                } else {
                    navigate('/panel-settings?tab=users');
                }
            }
        } catch (error) {
            console.error('Erreur:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSaving(true);

        try {
            const url = isCreating ? '/api/v1/users' : `/api/v1/users/${id}`;
            const method = isCreating ? 'POST' : 'PUT';

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
                navigate('/panel-settings?tab=users');
            } else {
                const data = await response.json();
                setError(data.error || 'Une erreur est survenue');
            }
        } catch (err) {
            setError('Erreur de connexion au serveur');
            console.error('Erreur:', err);
        } finally {
            setIsSaving(false);
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

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (isLoading) return <div>Chargement...</div>;

    return (
        <div className="edit-user-page">
            {/* Form */}
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: '900px' }}>

                    {/* Left Column - Account Info */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            marginBottom: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <UserIcon size={18} style={{ color: 'var(--color-accent)' }} />
                            Informations du compte
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Username */}
                            <div className="form-group">
                                <label>{t('users.username')}</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="nom_utilisateur"
                                    required
                                    className="input"
                                />
                            </div>

                            {/* Password */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Key size={14} style={{ color: 'var(--color-accent)' }} />
                                    {isCreating ? t('auth.password') : t('user_settings.new_password')}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={isCreating ? '' : t('users.password_placeholder')}
                                    required={isCreating}
                                    className="input"
                                />
                                {!isCreating && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                        Laissez vide pour conserver le mot de passe actuel
                                    </p>
                                )}
                            </div>

                            {/* Role & Language */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Shield size={14} style={{ color: 'var(--color-accent)' }} />
                                        {t('users.role')}
                                    </label>
                                    <Select
                                        options={[
                                            { label: t('user_settings.role_user'), value: 'user', icon: <UserIcon size={14} /> },
                                            { label: t('user_settings.role_admin'), value: 'admin', icon: <Shield size={14} /> }
                                        ]}
                                        value={formData.role}
                                        onChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'user' })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Globe size={14} style={{ color: 'var(--color-accent)' }} />
                                        {t('settings.language')}
                                    </label>
                                    <Select
                                        options={LANGUAGES.map(lang => ({
                                            label: lang.name,
                                            value: lang.code
                                        }))}
                                        value={formData.language}
                                        onChange={(value) => setFormData({ ...formData, language: value })}
                                    />
                                </div>
                            </div>

                            {/* Active Status */}
                            <Checkbox
                                checked={formData.is_active}
                                onChange={(v) => setFormData({ ...formData, is_active: v })}
                                label="Compte actif"
                                description="Un compte désactivé ne peut pas se connecter"
                                className="full-width-checkbox"
                            />
                        </div>
                    </div>

                    {/* Right Column - Personalization */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            marginBottom: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <Palette size={18} style={{ color: 'var(--color-accent)' }} />
                            Personnalisation
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Accent Color */}
                            <div className="form-group">
                                <label>{t('user_settings.accent_color')}</label>
                                <div className="color-picker">
                                    {PRESET_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, accent_color: color })}
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
                                            onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Server Allocation */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Server size={14} style={{ color: 'var(--color-accent)' }} />
                                    Serveurs alloués
                                </label>
                                {servers.length === 0 ? (
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                        Aucun serveur disponible
                                    </p>
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
                        </div>
                    </div>

                    {/* Full Width - User Info (only when editing) */}
                    {!isCreating && user && (
                        <div className="card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                marginBottom: '1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <Clock size={18} style={{ color: 'var(--color-accent)' }} />
                                Informations système
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                <div style={{
                                    padding: '1rem',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: '8px'
                                }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                                        Créé le
                                    </p>
                                    <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                        {formatDate(user.created_at)}
                                    </p>
                                </div>
                                <div style={{
                                    padding: '1rem',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: '8px'
                                }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                                        Modifié le
                                    </p>
                                    <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                        {formatDate(user.updated_at)}
                                    </p>
                                </div>
                                <div style={{
                                    padding: '1rem',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: '8px'
                                }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                                        Dernière connexion
                                    </p>
                                    <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                        {formatDate(user.last_login)}
                                    </p>
                                </div>
                                <div style={{
                                    padding: '1rem',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: '8px'
                                }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                                        Dernière IP
                                    </p>
                                    <p style={{ fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>
                                        {user.last_ip || '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        color: '#ef4444',
                        fontSize: '0.875rem',
                        maxWidth: '900px'
                    }}>
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginTop: '1.5rem',
                    maxWidth: '900px'
                }}>
                    <Link to="/panel-settings?tab=users" className="btn btn--secondary" style={{ minWidth: '120px' }}>
                        {t('common.cancel')}
                    </Link>
                    <button
                        type="submit"
                        className="btn btn--primary"
                        disabled={isSaving || !formData.username}
                        style={{ minWidth: '180px' }}
                    >
                        {isSaving ? (
                            t('common.loading')
                        ) : (
                            <>
                                <Save size={18} />
                                {isCreating ? t('common.create') : t('common.save')}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
