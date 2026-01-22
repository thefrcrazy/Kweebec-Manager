import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, Square, RotateCw, Terminal, Cpu, HardDrive, Settings } from 'lucide-react';

interface Server {
    id: string;
    name: string;
    game_type: string;
    status: string;
}

import { useLanguage } from '../contexts/LanguageContext';
import { usePageTitle } from '../contexts/PageTitleContext';

export default function ServerDetail() {
    const { t } = useLanguage();
    const { setPageTitle } = usePageTitle();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const [server, setServer] = useState<Server | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [command, setCommand] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchServer();
        connectWebSocket();

        return () => {
            wsRef.current?.close();
        };
    }, [id]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const fetchServer = async () => {
        const response = await fetch(`/api/v1/servers/${id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setServer(await response.json());
    }


    useEffect(() => {
        if (server) {
            setPageTitle(server.name, 'Hytale Server', { to: '/servers' });
        } else {
            setPageTitle(t('common.loading'), '', { to: '/servers' });
        }
    }, [server, setPageTitle, t]);

    const connectWebSocket = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws/console/${id}`);

        ws.onopen = () => {
            setIsConnected(true);
            setLogs((prev) => [...prev, `[SYSTEM] ${t('discord_connected')}...`]);
        };

        ws.onmessage = (event) => {
            setLogs((prev) => [...prev, event.data]);
        };

        ws.onclose = () => {
            setIsConnected(false);
            setLogs((prev) => [...prev, `[SYSTEM] ${t('discord_disconnected')}`]);
        };

        wsRef.current = ws;
    };

    const handleAction = async (action: 'start' | 'stop' | 'restart') => {
        await fetch(`/api/v1/servers/${id}/${action}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        fetchServer();
        setTimeout(fetchServer, 1000);
        setTimeout(fetchServer, 3000);
        setTimeout(fetchServer, 5000);
    };

    const sendCommand = (e: React.FormEvent) => {
        e.preventDefault();
        if (command.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(command);
            setCommand('');
        }
    };

    if (!server) return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>{t('common.loading')}</div>;

    return (
        <div>
            <div className="page-header" style={{ justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {server.status === 'stopped' ? (
                        <button className="btn btn--success" onClick={() => handleAction('start')}>
                            <Play size={18} /> {t('server_detail.start')}
                        </button>
                    ) : (
                        <>
                            <button className="btn btn--secondary" onClick={() => handleAction('restart')}>
                                <RotateCw size={18} /> {t('server_detail.restart')}
                            </button>
                            <button className="btn btn--danger" onClick={() => handleAction('stop')}>
                                <Square size={18} /> {t('server_detail.stop')}
                            </button>
                        </>
                    )}

                    <button
                        className="btn btn--secondary"
                        onClick={() => navigate(`/servers/${id}/settings`)}
                        title="Configuration du serveur"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>

                <div className="console">
                    <div className="console__header">
                        <div className="console__title">
                            <Terminal size={18} />
                            {t('server_detail.console')}
                        </div>
                        <div className="console__status">
                            <span className={`console__status-dot console__status-dot--${isConnected ? 'connected' : 'disconnected'}`} />
                            {isConnected ? t('discord_connected') : t('discord_disconnected')}
                        </div>
                    </div>

                    <div className="console__output">
                        {logs.map((log, i) => (
                            <div
                                key={i}
                                className={`console__output-line ${log.includes('[ERROR]') || log.includes('ERROR') || log.includes('Exception')
                                    ? 'console__output-line--error'
                                    : log.includes('[WARN]') || log.includes('WARN')
                                        ? 'console__output-line--warning'
                                        : log.includes('[INFO]')
                                            ? 'console__output-line--info'
                                            : ''
                                    }`}
                            >
                                {log}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>

                    <form onSubmit={sendCommand} className="console__input">
                        <div style={{ color: 'var(--color-accent)', paddingLeft: '0.5rem', fontWeight: 'bold' }}>{'>'}</div>
                        <input
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            placeholder={t('common.search')}
                            disabled={!isConnected || server.status !== 'running'}
                        />
                    </form>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Cpu size={18} /> CPU
                        </h3>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>-- %</div>
                        <div style={{ height: '4px', background: 'var(--color-bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: '0%', height: '100%', background: 'var(--color-accent)' }}></div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <HardDrive size={18} /> {t('server_detail.memory')}
                        </h3>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>-- / -- GB</div>
                        <div style={{ height: '4px', background: 'var(--color-bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: '0%', height: '100%', background: 'var(--color-info)' }}></div>
                        </div>
                    </div>
                </div>

            </div>
        </div >
    );
}
