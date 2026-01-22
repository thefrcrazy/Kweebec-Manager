import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Server, FolderOpen, FileCode, Cpu, Settings, Network, Shield,
    HardDrive, Save, Globe, Info, Zap, Terminal, Star, ChevronDown, ChevronUp,
    Gamepad2, Layers, Map as MapIcon, Trash2
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import Select from '../components/Select';
import Checkbox from '../components/Checkbox';

// Arguments JVM recommandés
const JVM_ARGS_SUGGESTIONS = [
    { arg: '-XX:AOTCache=HytaleServer.aot', desc: 'Accélère considérablement le démarrage du serveur (AOT)', isRecommended: true },
    { arg: '-XX:+UseG1GC', desc: 'Garbage Collector G1 - Équilibre latence et débit', isRecommended: false },
    { arg: '-XX:+UseZGC', desc: 'Garbage Collector ZGC - Latence ultra-faible (<1ms)', isRecommended: false },
    { arg: '-XX:MaxGCPauseMillis=50', desc: 'Limite les pauses du GC à 50ms max', isRecommended: false },
    { arg: '-XX:+ParallelRefProcEnabled', desc: 'Traite les références en parallèle', isRecommended: false },
    { arg: '-XX:+DisableExplicitGC', desc: 'Ignore les appels System.gc()', isRecommended: false },
    { arg: '-XX:+AlwaysPreTouch', desc: 'Précharge toute la RAM au démarrage', isRecommended: false },
    { arg: '-XX:+UseStringDeduplication', desc: 'Déduplique les chaînes pour économiser la RAM', isRecommended: false },
    { arg: '-Dfile.encoding=UTF-8', desc: 'Force l\'encodage UTF-8', isRecommended: false },
];

interface ServerFormData {
    name: string;
    executable_path: string;
    working_dir: string;
    bind_address: string;
    port: number;
    auth_mode: 'authenticated' | 'offline';
    allow_op: boolean;
    max_memory: string;
    min_memory: string;
    java_path: string;
    extra_args: string;
    assets_path: string;
    accept_early_plugins: boolean;
    backup_enabled: boolean;
    backup_dir: string;
    backup_frequency: number;
    auto_start: boolean;
    disable_sentry: boolean;
    // World configs (often read-only or informational for existing servers, but let's keep them editable if supported)
    seed: string;
    world_gen_type: string;
    view_distance: number;
    is_pvp_enabled: boolean;
    is_fall_damage_enabled: boolean;
    is_spawning_npc: boolean;
    is_game_time_paused: boolean;
    is_saving_players: boolean;
    is_ticking: boolean;
    is_block_ticking: boolean;
    is_all_npc_frozen: boolean;
    is_saving_chunks: boolean;
    is_unloading_chunks: boolean;
    is_spawn_markers_enabled: boolean;
    is_compass_updating: boolean;
    is_objective_markers_enabled: boolean;
    delete_on_universe_start: boolean;
    delete_on_remove: boolean;
}

export default function EditServer() {
    const { id } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(true); // Default open for edit
    const [showWorldConfig, setShowWorldConfig] = useState(false);
    const [showJvmSuggestions, setShowJvmSuggestions] = useState(false);
    const [showBackupConfig, setShowBackupConfig] = useState(false);
    const [showGameplayConfig, setShowGameplayConfig] = useState(false);
    const [showSimulationConfig, setShowSimulationConfig] = useState(false);
    const [showInterfaceConfig, setShowInterfaceConfig] = useState(false);
    const [javaVersions, setJavaVersions] = useState<{ path: string; version: string }[]>([]);

    const [formData, setFormData] = useState<ServerFormData>({
        name: '',
        executable_path: 'HytaleServer.jar',
        working_dir: '',
        bind_address: '0.0.0.0',
        port: 5520,
        auth_mode: 'authenticated',
        allow_op: false,
        max_memory: '4G',
        min_memory: '4G',
        java_path: '',
        extra_args: '',
        assets_path: '../HytaleAssets',
        accept_early_plugins: false,
        backup_enabled: false,
        backup_dir: '',
        backup_frequency: 30,
        auto_start: false,
        disable_sentry: false,
        seed: '',
        world_gen_type: 'Hytale',
        view_distance: 12,
        is_pvp_enabled: true,
        is_fall_damage_enabled: true,
        is_spawning_npc: true,
        is_game_time_paused: false,
        is_saving_players: true,
        is_ticking: true,
        is_block_ticking: true,
        is_all_npc_frozen: false,
        is_saving_chunks: true,
        is_unloading_chunks: true,
        is_spawn_markers_enabled: true,
        is_compass_updating: true,
        is_objective_markers_enabled: true,
        delete_on_universe_start: false,
        delete_on_remove: false,
    });

    const { setPageTitle } = usePageTitle();
    useEffect(() => {
        setPageTitle('Configuration du serveur', formData.name || 'Chargement...', { to: `/servers/${id}` });
    }, [setPageTitle, formData.name, id]);

    // Load Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [serverRes, javaRes] = await Promise.all([
                    fetch(`/api/v1/servers/${id}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    }),
                    fetch('/api/v1/system/java-versions', {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    })
                ]);

                if (javaRes.ok) {
                    setJavaVersions(await javaRes.json());
                }

                if (serverRes.ok) {
                    const data = await serverRes.json();
                    // Merge API data with defaults
                    setFormData(prev => ({
                        ...prev,
                        ...data,
                        // Ensure nested objects or specific fields are mapped correctly if needed
                    }));
                } else {
                    setError('Impossible de charger le serveur');
                }
            } catch (err) {
                console.error(err);
                setError('Erreur de connexion');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');

        try {
            const response = await fetch(`/api/v1/servers/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                navigate(`/servers/${id}`);
            } else {
                const data = await response.json();
                setError(data.error || 'Erreur lors de la sauvegarde');
            }
        } catch (err) {
            setError('Erreur de connexion');
        } finally {
            setIsSaving(false);
        }
    };

    const updateFormData = <K extends keyof ServerFormData>(key: K, value: ServerFormData[K]) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const toggleJvmArg = (arg: string) => {
        let currentArgsParts = formData.extra_args.trim().split(/\s+/).filter(a => a.length > 0);
        if (currentArgsParts.includes(arg)) {
            currentArgsParts = currentArgsParts.filter(a => a !== arg);
        } else {
            currentArgsParts.push(arg);
        }
        updateFormData('extra_args', currentArgsParts.join(' '));
    };

    const InfoTooltip = ({ text }: { text: string }) => (
        <span title={text} style={{ marginLeft: '0.5rem', cursor: 'help' }}>
            <Info size={14} style={{ color: 'var(--color-text-muted)', opacity: 0.7 }} />
        </span>
    );

    const CollapsibleSection = ({ title, icon: Icon, isOpen, onToggle, children, badge }: any) => (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
                type="button"
                onClick={onToggle}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.5rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-primary)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon size={18} style={{ color: 'var(--color-accent)' }} />
                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</span>
                    {badge && (
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: 'var(--color-accent)', color: 'white', borderRadius: '4px', fontWeight: 600 }}>{badge}</span>
                    )}
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {isOpen && <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>{children}</div>}
        </div>
    );

    if (isLoading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="edit-server-page">
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>

                    {/* General */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Server size={18} style={{ color: 'var(--color-accent)' }} />
                            Informations générales
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Nom du serveur</label>
                                <input type="text" value={formData.name} onChange={(e) => updateFormData('name', e.target.value)} className="input" required />
                            </div>
                            <div className="form-group">
                                <label>Répertoire (Working Dir)</label>
                                <input type="text" value={formData.working_dir} onChange={(e) => updateFormData('working_dir', e.target.value)} className="input" style={{ fontFamily: 'var(--font-family-mono)' }} />
                            </div>
                            <div className="form-group">
                                <label>Exécutable</label>
                                <input type="text" value={formData.executable_path} onChange={(e) => updateFormData('executable_path', e.target.value)} className="input" style={{ fontFamily: 'var(--font-family-mono)' }} />
                            </div>
                        </div>
                    </div>

                    {/* Network & Auth */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Network size={18} style={{ color: 'var(--color-accent)' }} />
                            Réseau & Sécurité
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Bind Address</label>
                                <input type="text" value={formData.bind_address} onChange={(e) => updateFormData('bind_address', e.target.value)} className="input" />
                            </div>
                            <div className="form-group">
                                <label>Port UDP</label>
                                <input type="number" value={formData.port} onChange={(e) => updateFormData('port', parseInt(e.target.value))} className="input" />
                            </div>
                            <div className="form-group">
                                <label>Mode Auth</label>
                                <Select
                                    options={[{ label: 'Authenticated', value: 'authenticated' }, { label: 'Offline', value: 'offline' }]}
                                    value={formData.auth_mode}
                                    onChange={(v) => updateFormData('auth_mode', v as any)}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'end' }}>
                                <Checkbox checked={formData.allow_op} onChange={(v) => updateFormData('allow_op', v)} label="Allow OP" />
                            </div>
                        </div>
                    </div>

                    {/* Advanced Params */}
                    <CollapsibleSection title="Performance & Java" icon={Cpu} isOpen={showAdvanced} onToggle={() => setShowAdvanced(!showAdvanced)}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Min RAM</label>
                                <input type="text" value={formData.min_memory} onChange={(e) => updateFormData('min_memory', e.target.value)} className="input" />
                            </div>
                            <div className="form-group">
                                <label>Max RAM</label>
                                <input type="text" value={formData.max_memory} onChange={(e) => updateFormData('max_memory', e.target.value)} className="input" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Java Path</label>
                                <Select
                                    options={[{ label: 'System Default', value: '' }, ...javaVersions.map(j => ({ label: `Java ${j.version} (${j.path})`, value: j.path }))]}
                                    value={formData.java_path}
                                    onChange={(v) => updateFormData('java_path', v)}
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Arguments JVM</label>
                                <input type="text" value={formData.extra_args} onChange={(e) => updateFormData('extra_args', e.target.value)} className="input" style={{ fontFamily: 'var(--font-family-mono)' }} />
                                <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {JVM_ARGS_SUGGESTIONS.map(({ arg, isRecommended }) => (
                                        <button
                                            key={arg}
                                            type="button"
                                            onClick={() => toggleJvmArg(arg)}
                                            style={{
                                                fontSize: '0.75rem',
                                                padding: '0.2rem 0.5rem',
                                                border: `1px solid ${formData.extra_args.includes(arg) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                                                background: formData.extra_args.includes(arg) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                color: formData.extra_args.includes(arg) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isRecommended && <Star size={10} style={{ display: 'inline', marginRight: '4px' }} />}
                                            {arg}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>


                    {/* ===== SECTION: Sauvegardes ===== */}
                    <CollapsibleSection
                        title="Sauvegardes Automatiques"
                        icon={HardDrive}
                        isOpen={showBackupConfig}
                        onToggle={() => setShowBackupConfig(!showBackupConfig)}
                    >
                        <div className="form-group">
                            <Checkbox
                                checked={formData.backup_enabled}
                                onChange={(v) => updateFormData('backup_enabled', v)}
                                label="Activer les sauvegardes automatiques"
                            />
                        </div>
                        {formData.backup_enabled && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                                <div className="form-group">
                                    <label>Répertoire de sauvegarde</label>
                                    <input type="text" value={formData.backup_dir} onChange={(e) => updateFormData('backup_dir', e.target.value)} className="input" style={{ fontFamily: 'var(--font-family-mono)' }} />
                                </div>
                                <div className="form-group">
                                    <label>Fréquence (minutes)</label>
                                    <input type="number" value={formData.backup_frequency} onChange={(e) => updateFormData('backup_frequency', parseInt(e.target.value))} className="input" min={5} />
                                </div>
                            </div>
                        )}
                    </CollapsibleSection>

                    {/* ===== SECTION: Configuration du Monde ===== */}
                    <CollapsibleSection title="Configuration du Monde" icon={Globe} isOpen={showWorldConfig} onToggle={() => setShowWorldConfig(!showWorldConfig)}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Seed (Graine)</label>
                                <input type="text" value={formData.seed} onChange={(e) => updateFormData('seed', e.target.value)} className="input" placeholder="Laisser vide pour aléatoire" />
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Note: Changer la seed n'affecte pas les zones déjà explorées.</p>
                            </div>
                            <div className="form-group">
                                <label>Distance de vue</label>
                                <input type="number" value={formData.view_distance} onChange={(e) => updateFormData('view_distance', parseInt(e.target.value))} className="input" min={4} max={32} />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Generator settings</label>
                                <input type="text" value={formData.world_gen_type} onChange={(e) => updateFormData('world_gen_type', e.target.value)} className="input" placeholder="Hytale" />
                            </div>
                        </div>
                    </CollapsibleSection>

                    {/* ===== SECTION: Gameplay ===== */}
                    <CollapsibleSection
                        title="Gameplay"
                        icon={Gamepad2}
                        isOpen={showGameplayConfig}
                        onToggle={() => setShowGameplayConfig(!showGameplayConfig)}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <Checkbox checked={formData.is_pvp_enabled} onChange={(v) => updateFormData('is_pvp_enabled', v)} label="PvP Activé" />
                            <Checkbox checked={formData.is_fall_damage_enabled} onChange={(v) => updateFormData('is_fall_damage_enabled', v)} label="Dégâts de chute" />
                            <Checkbox checked={formData.is_spawning_npc} onChange={(v) => updateFormData('is_spawning_npc', v)} label="Apparition NPC" />
                            <Checkbox checked={formData.is_game_time_paused} onChange={(v) => updateFormData('is_game_time_paused', v)} label="Temps figé" />
                            <Checkbox checked={formData.is_saving_players} onChange={(v) => updateFormData('is_saving_players', v)} label="Sauvegarde Joueurs" />
                        </div>
                    </CollapsibleSection>

                    {/* ===== SECTION: Chunks & Ticking ===== */}
                    <CollapsibleSection title="Simulation & Chunks" icon={Layers} isOpen={showSimulationConfig} onToggle={() => setShowSimulationConfig(!showSimulationConfig)}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <Checkbox checked={formData.is_ticking} onChange={(v) => updateFormData('is_ticking', v)} label="Ticking Global" />
                            <Checkbox checked={formData.is_block_ticking} onChange={(v) => updateFormData('is_block_ticking', v)} label="Block Ticking" />
                            <Checkbox checked={formData.is_all_npc_frozen} onChange={(v) => updateFormData('is_all_npc_frozen', v)} label="Figer les NPCs" />
                            <Checkbox checked={formData.is_saving_chunks} onChange={(v) => updateFormData('is_saving_chunks', v)} label="Sauvegarde Chunks" />
                            <Checkbox checked={formData.is_unloading_chunks} onChange={(v) => updateFormData('is_unloading_chunks', v)} label="Unload Chunks" />
                        </div>
                    </CollapsibleSection>

                    {/* ===== SECTION: UI & Cleanup ===== */}
                    <CollapsibleSection title="Interface & Nettoyage" icon={MapIcon} isOpen={showInterfaceConfig} onToggle={() => setShowInterfaceConfig(!showInterfaceConfig)}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <Checkbox checked={formData.is_spawn_markers_enabled} onChange={(v) => updateFormData('is_spawn_markers_enabled', v)} label="Marqueurs Spawn" />
                            <Checkbox checked={formData.is_compass_updating} onChange={(v) => updateFormData('is_compass_updating', v)} label="Boussole Active" />
                            <Checkbox checked={formData.is_objective_markers_enabled} onChange={(v) => updateFormData('is_objective_markers_enabled', v)} label="Marqueurs Objectifs" />
                        </div>
                        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#ef4444' }}>Zone Dangereuse</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <Checkbox checked={formData.delete_on_universe_start} onChange={(v) => updateFormData('delete_on_universe_start', v)} label="Reset au démarrage" description="ATTENTION: Supprime le monde au lancement !" />
                                {/* delete_on_remove is mostly meta for manager, but can be here */}
                            </div>
                        </div>
                    </CollapsibleSection>


                    {error && <div className="alert alert--error">{error}</div>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn--secondary" onClick={() => navigate(`/servers/${id}`)}>Annuler</button>
                        <button type="submit" className="btn btn--primary" disabled={isSaving}>
                            <Save size={18} />
                            {isSaving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
