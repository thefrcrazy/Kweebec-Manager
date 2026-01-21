import { Plus, Play, Square, Trash2, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Server {
    id: string;
    name: string;
    game_type: string;
    status: string;
    executable_path: string;
    working_dir: string;
}

import { useLanguage } from '../contexts/LanguageContext';

export default function Servers() {
    const { t } = useLanguage();
    const [servers, setServers] = useState<Server[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchServers();
    }, []);

    const fetchServers = async () => {
        try {
            const response = await fetch('/api/v1/servers', {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (response.ok) {
                setServers(await response.json());
            }
        } catch (error) {
            console.error('Erreur:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (id: string, action: 'start' | 'stop') => {
        try {
            await fetch(`/api/v1/servers/${id}/${action}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            fetchServers();
            // Polling recommended here
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('backups.delete_confirm'))) return;

        await fetch(`/api/v1/servers/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        fetchServers();
    };

    if (isLoading) return <div>Chargement...</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header__title">{t('servers.title')}</h1>
                    <p className="page-header__subtitle">{t('dashboard.welcome')}</p>
                </div>
                <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} />
                    {t('servers.create_new')}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {servers.map((server) => (
                    <div key={server.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0', overflow: 'hidden' }}>

                        {/* Status Bar */}
                        <div style={{
                            height: '4px',
                            background: server.status === 'running' ? '#10b981' : 'var(--color-bg-elevated)',
                            width: '100%'
                        }} />

                        <div style={{ padding: '1.5rem', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>{server.name}</h3>
                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                                        <span style={{
                                            background: 'var(--color-bg-elevated)',
                                            padding: '0.125rem 0.5rem',
                                            borderRadius: '4px',
                                            color: 'var(--color-text-muted)'
                                        }}>
                                            {server.game_type.toUpperCase()}
                                        </span>
                                        <span style={{
                                            background: server.status === 'running' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: server.status === 'running' ? '#10b981' : '#ef4444',
                                            padding: '0.125rem 0.5rem',
                                            borderRadius: '4px',
                                            border: `1px solid ${server.status === 'running' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                        }}>
                                            {server.status === 'running' ? 'EN LIGNE' : 'ARRÊTÉ'}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {/* Quick Actions */}
                                    {server.status === 'stopped' ? (
                                        <button
                                            className="btn btn--success btn--icon"
                                            style={{ width: '32px', height: '32px', padding: 0 }}
                                            onClick={() => handleAction(server.id, 'start')}
                                            title="Démarrer"
                                        >
                                            <Play size={16} />
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn--danger btn--icon"
                                            style={{ width: '32px', height: '32px', padding: 0 }}
                                            onClick={() => handleAction(server.id, 'stop')}
                                            title="Arrêter"
                                        >
                                            <Square size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                background: 'var(--color-bg-secondary)',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                color: 'var(--color-text-muted)',
                                fontFamily: 'var(--font-family-mono)',
                                marginBottom: '1.5rem',
                                wordBreak: 'break-all'
                            }}>
                                <span style={{ color: 'var(--color-secondary)' }}>$</span> {server.working_dir}
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <Link to={`/servers/${server.id}`} className="btn btn--secondary" style={{ flex: 1 }}>
                                    <Terminal size={16} />
                                    Console
                                </Link>
                                <button className="btn btn--ghost btn--icon" onClick={() => handleDelete(server.id)} title="Supprimer">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Create New Card (Empty State) */}
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="card"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        borderStyle: 'dashed',
                        cursor: 'pointer',
                        minHeight: '220px',
                        background: 'transparent',
                        borderColor: 'var(--color-border)',
                    }}
                >
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'var(--color-bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem',
                        color: 'var(--color-text-muted)'
                    }}>
                        <Plus size={24} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Créer un serveur</span>
                </button>
            </div>

            {showCreateModal && (
                <CreateServerModal onClose={() => setShowCreateModal(false)} onCreated={fetchServers} />
            )}
        </div>
    );
}

function CreateServerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        name: '',
        executable_path: 'HytaleServer.jar',
        working_dir: '/opt/hytale',
        max_memory: '8G',
        min_memory: '4G',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/v1/servers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ ...formData, game_type: 'hytale' }),
            });

            if (response.ok) {
                onCreated();
                onClose();
            }
        } catch (error) {
            console.error('Erreur:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>{t('servers.create_new')}</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('backups.backup_name')}</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Mon Serveur Hytale"
                            required
                            className="input"
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Répertoire de travail</label>
                        <input
                            type="text"
                            value={formData.working_dir}
                            onChange={(e) => setFormData({ ...formData, working_dir: e.target.value })}
                            placeholder="/opt/hytale"
                            required
                            className="input"
                            style={{ fontFamily: 'var(--font-family-mono)' }}
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Fichier exécutable</label>
                        <input
                            type="text"
                            value={formData.executable_path}
                            onChange={(e) => setFormData({ ...formData, executable_path: e.target.value })}
                            placeholder="HytaleServer.jar"
                            required
                            className="input"
                            style={{ fontFamily: 'var(--font-family-mono)' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>RAM Min</label>
                            <input
                                type="text"
                                value={formData.min_memory}
                                onChange={(e) => setFormData({ ...formData, min_memory: e.target.value })}
                                placeholder="4G"
                                className="input"
                            />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>RAM Max</label>
                            <input
                                type="text"
                                value={formData.max_memory}
                                onChange={(e) => setFormData({ ...formData, max_memory: e.target.value })}
                                placeholder="8G"
                                className="input"
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button type="button" className="btn btn--secondary" onClick={onClose} style={{ flex: 1 }}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="btn btn--primary" disabled={isSubmitting} style={{ flex: 1 }}>
                            {isSubmitting ? t('common.loading') : t('common.create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
