import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Plus, Play, Square, Terminal, Server as ServerIcon, Settings
} from 'lucide-react';
import Table from '../components/Table';
import { useLanguage } from '../contexts/LanguageContext';
import { usePageTitle } from '../contexts/PageTitleContext';

interface Server {
    id: string;
    name: string;
    game_type: string;
    status: string;
    executable_path: string;
    working_dir: string;
    auto_start: boolean;
}

export default function Servers() {
    const { t } = useLanguage();
    const [servers, setServers] = useState<Server[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Mock stats for UI demo (since backend doesn't provide them in list yet)
    // In real impl, these should come from websocket or API
    const getMockStats = (server: Server) => {
        if (server.status !== 'running') return { cpu: 0, memory: 0, memoryMax: 4096, disk: 1.2, players: 0, maxPlayers: 20 };
        // Random values for running servers to show UI
        return {
            cpu: Math.floor(Math.random() * 30) + 1,
            memory: Math.floor(Math.random() * 2048) + 512,
            memoryMax: 4096,
            disk: 1.3,
            players: Math.floor(Math.random() * 5),
            maxPlayers: 20
        };
    };

    const { setPageTitle } = usePageTitle();
    useEffect(() => {
        setPageTitle(t('servers.title'), t('dashboard.welcome'), { to: '/' });
    }, [setPageTitle, t]);

    useEffect(() => {
        fetchServers();
        // Setup polling for status updates
        const interval = setInterval(fetchServers, 5000);
        return () => clearInterval(interval);
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

    const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
        try {
            await fetch(`/api/v1/servers/${id}/${action}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            fetchServers();
        } catch (e) {
            console.error(e);
        }
    };



    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header__title">{t('servers.title')}</h1>
                    <p className="page-header__subtitle">Gérez vos instances de serveurs de jeu</p>
                </div>
                <Link to="/servers/create" className="btn btn--primary">
                    <Plus size={18} />
                    {t('servers.create_new')}
                </Link>
            </div>

            {servers.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">
                        <ServerIcon size={48} />
                    </div>
                    <h3 className="empty-state__title">Aucun serveur</h3>
                    <p className="empty-state__description">Commencez par créer votre premier serveur Hytale.</p>
                    <Link to="/servers/create" className="btn btn--primary">
                        <Plus size={18} />
                        Créer un serveur
                    </Link>
                </div>

            ) : (
                <Table>
                    <thead>
                        <tr>
                            <th style={{ width: '25%' }}>Serveur</th>
                            <th style={{ width: '15%' }}>Actions</th>
                            <th style={{ width: '15%' }}>CPU Usage</th>
                            <th style={{ width: '15%' }}>Memory Usage</th>
                            <th style={{ width: '10%' }}>Disk</th>
                            <th style={{ width: '10%' }}>Players</th>
                            <th style={{ width: '10%', textAlign: 'right' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {servers.map(server => {
                            const stats = getMockStats(server);
                            const isRunning = server.status === 'running';

                            return (
                                <tr key={server.id} style={{
                                    background: isRunning ? 'rgba(16, 185, 129, 0.02)' : 'transparent'
                                }}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '8px',
                                                background: isRunning ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg-tertiary)',
                                                color: isRunning ? 'var(--color-success)' : 'var(--color-text-muted)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <ServerIcon size={20} />
                                            </div>
                                            <div>
                                                <Link to={`/servers/${server.id}`} className="text-primary" style={{ fontWeight: 600, display: 'block', textDecoration: 'none' }}>
                                                    {server.name}
                                                </Link>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{server.game_type}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="table__actions" style={{ justifyContent: 'flex-start' }}>
                                            {server.status === 'stopped' ? (
                                                <button
                                                    className="btn btn--icon btn--ghost"
                                                    onClick={() => handleAction(server.id, 'start')}
                                                    title="Démarrer"
                                                    style={{ color: 'var(--color-success)' }}
                                                >
                                                    <Play size={18} />
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn btn--icon btn--ghost"
                                                    onClick={() => handleAction(server.id, 'stop')}
                                                    title="Arrêter"
                                                    style={{ color: 'var(--color-danger)' }}
                                                >
                                                    <Square size={18} />
                                                </button>
                                            )}

                                            <Link to={`/servers/${server.id}`} className="btn btn--icon btn--ghost" title="Console">
                                                <Terminal size={18} />
                                            </Link>

                                            <Link to={`/servers/${server.id}/settings`} className="btn btn--icon btn--ghost" title="Paramètres">
                                                <Settings size={18} />
                                            </Link>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ height: '6px', width: '100%', background: 'var(--color-bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${stats.cpu}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 0.5s ease' }} />
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{stats.cpu.toFixed(1)}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ height: '6px', width: '100%', background: 'var(--color-bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${(stats.memory / stats.memoryMax) * 100}%`, height: '100%', background: 'var(--color-info)', transition: 'width 0.5s ease' }} />
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                {stats.memory} MB / {stats.memoryMax / 1024} GB
                                            </span>
                                        </div>
                                    </td>
                                    <td className="text-muted" style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.85rem' }}>
                                        {stats.disk} GB
                                    </td>
                                    <td className="text-muted">
                                        {stats.players} / {stats.maxPlayers}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className={`badge badge--${server.status === 'running' ? 'success' : 'danger'}`}>
                                            {server.status === 'running' ? 'Online' : 'Offline'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            )}
        </div >
    );
}
