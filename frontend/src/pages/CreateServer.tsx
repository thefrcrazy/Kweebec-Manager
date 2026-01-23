import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Server, FolderOpen, Upload, FolderArchive,
    Rocket, Play
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { usePageTitle } from '../contexts/PageTitleContext';

type CreationMode = 'normal' | 'existing' | 'zip';

// Liste des arguments JVM recommandés pour Hytale
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

export default function CreateServer() {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [creationMode, setCreationMode] = useState<CreationMode>('normal');
    const [formData, setFormData] = useState<ServerFormData>({
        // Section 1: Informations générales
        name: '',
        executable_path: 'HytaleServer.jar',
        working_dir: '',

        // Section 2: Configuration Réseau
        bind_address: '0.0.0.0',
        port: 5520,

        // Defaults hidden
        auth_mode: 'authenticated',
        allow_op: false,
        max_memory: '4G',
        min_memory: '4G',
        java_path: '',
        extra_args: JVM_ARGS_SUGGESTIONS.filter(s => s.isRecommended).map(s => s.arg).join(' '),
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
    const [zipFile, setZipFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const { setPageTitle } = usePageTitle();
    useEffect(() => {
        setPageTitle(t('servers.create_new'), 'Configurez votre nouveau serveur Hytale', { to: '/servers' });
    }, [setPageTitle, t]);

    const creationModes = [
        { id: 'normal' as CreationMode, label: 'Nouveau serveur', icon: Plus, description: 'Créer un nouveau serveur vide' },
        { id: 'existing' as CreationMode, label: 'Serveur existant', icon: FolderOpen, description: 'Importer un serveur déjà configuré' },
        { id: 'zip' as CreationMode, label: 'Importer .zip', icon: FolderArchive, description: 'Importer depuis une archive ZIP' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            if (creationMode === 'zip' && zipFile) {
                const formDataUpload = new FormData();
                formDataUpload.append('file', zipFile);
                formDataUpload.append('name', formData.name);
                formDataUpload.append('min_memory', formData.min_memory);
                formDataUpload.append('max_memory', formData.max_memory);
                formDataUpload.append('auto_start', String(formData.auto_start));
                if (formData.java_path) formDataUpload.append('java_path', formData.java_path);
                if (formData.extra_args) formDataUpload.append('extra_args', formData.extra_args);

                const response = await fetch('/api/v1/servers/import-zip', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: formDataUpload,
                });

                if (response.ok) {
                    navigate('/servers');
                } else {
                    const data = await response.json();
                    setError(data.error || 'Erreur lors de l\'importation');
                }
            } else {
                const response = await fetch('/api/v1/servers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({
                        ...formData,
                        game_type: 'hytale',
                        java_path: formData.java_path || null,
                        extra_args: formData.extra_args || null,
                        assets_path: formData.assets_path || null,
                        backup_dir: formData.backup_dir || null,
                        seed: formData.seed || null,
                        import_existing: creationMode === 'existing',
                    }),
                });

                if (response.ok) {
                    navigate('/servers');
                } else {
                    const data = await response.json();
                    setError(data.error || 'Erreur lors de la création');
                }
            }
        } catch (err) {
            setError('Erreur de connexion au serveur');
            console.error('Erreur:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.name.endsWith('.zip')) {
            setZipFile(file);
            setError('');
        } else {
            setError('Veuillez sélectionner un fichier .zip valide');
        }
    };

    const updateFormData = <K extends keyof ServerFormData>(key: K, value: ServerFormData[K]) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="create-server-page">

            {/* Creation Mode Tabs */}
            <div className="creation-mode-tabs">
                {creationModes.map((mode) => (
                    <button
                        key={mode.id}
                        type="button"
                        onClick={() => setCreationMode(mode.id)}
                        className={`creation-mode-btn ${creationMode === mode.id ? 'creation-mode-btn--active' : ''}`}
                    >
                        <mode.icon size={24} />
                        <span>{mode.label}</span>
                    </button>
                ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
                <div className="card server-config-card">
                    <h3 className="server-config-title">
                        <Server size={20} />
                        Configuration du serveur
                    </h3>

                    <div className="server-config-grid">

                        {/* Server Name */}
                        <div className="form-group">
                            <label>Nom du serveur</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => updateFormData('name', e.target.value)}
                                placeholder="Mon Serveur Hytale"
                                required
                                className="input"
                            />
                        </div>

                        {/* ZIP Upload or Directory */}
                        {creationMode === 'zip' ? (
                            <div className="form-group">
                                <label className="form-label-icon">
                                    <Upload size={14} />
                                    Fichier ZIP
                                </label>
                                <div className={`zip-upload-zone ${zipFile ? 'zip-upload-zone--active' : ''}`}>
                                    <input
                                        type="file"
                                        accept=".zip"
                                        onChange={handleZipChange}
                                        id="zip-upload"
                                        className="hidden-input"
                                    />
                                    <label htmlFor="zip-upload" className="zip-upload-content">
                                        {zipFile ? (
                                            <>
                                                <FolderArchive size={32} className="zip-upload-file-icon" />
                                                <p className="zip-upload-file-name">{zipFile.name}</p>
                                                <p className="helper-text">
                                                    {(zipFile.size / 1024 / 1024).toFixed(2)} Mo
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={32} className="zip-upload-icon" />
                                                <p className="zip-upload-text">Cliquez pour sélectionner</p>
                                                <p className="helper-text">
                                                    Archive .zip du serveur
                                                </p>
                                            </>
                                        )}
                                    </label>
                                </div>
                            </div>
                        ) : (
                            /* Working Directory */
                            <div className="form-group">
                                <label className="form-label-icon">
                                    <FolderOpen size={14} />
                                    {creationMode === 'existing' ? 'Répertoire existant' : 'Répertoire du serveur'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.working_dir}
                                    onChange={(e) => updateFormData('working_dir', e.target.value)}
                                    placeholder="/home/hytale/servers/mon-serveur"
                                    required
                                    className="input font-mono"
                                />
                                <p className="helper-text helper-text--block">
                                    {creationMode === 'existing'
                                        ? 'Chemin vers le dossier contenant le serveur existant'
                                        : 'Chemin où le serveur sera installé'}
                                </p>
                            </div>
                        )}

                        <div className="server-config-row">
                            {/* RAM Min */}
                            <div className="form-group">
                                <label>RAM Min (Xms)</label>
                                <input
                                    type="text"
                                    value={formData.min_memory}
                                    onChange={(e) => updateFormData('min_memory', e.target.value)}
                                    placeholder="4G"
                                    className="input"
                                />
                            </div>

                            {/* RAM Max */}
                            <div className="form-group">
                                <label>RAM Max (Xmx)</label>
                                <input
                                    type="text"
                                    value={formData.max_memory}
                                    onChange={(e) => updateFormData('max_memory', e.target.value)}
                                    placeholder="4G"
                                    className="input"
                                />
                            </div>
                        </div>

                        {/* Port UDP */}
                        <div className="form-group">
                            <label>Port UDP</label>
                            <input
                                type="number"
                                value={formData.port}
                                onChange={(e) => updateFormData('port', parseInt(e.target.value) || 5520)}
                                placeholder="5520"
                                className="input"
                            />
                        </div>

                        {/* Hidden Defaults Confirmation */}
                        <div className="advanced-defaults">
                            <div className="advanced-defaults__header">
                                <Rocket size={14} />
                                <span>Paramètres avancés configurés par défaut :</span>
                            </div>
                            <ul>
                                <li>Arguments JVM optimisés (AOT activé)</li>
                                <li>Authentification activée</li>
                                <li>Sauvegardes désactivées (configurable après création)</li>
                            </ul>
                        </div>

                    </div>

                    {error && (
                        <div className="error-banner">
                            {error}
                        </div>
                    )}

                    <div className="form-footer">
                        <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={() => navigate('/servers')}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="btn btn--primary btn--lg"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <div className="spinner-sm" />
                            ) : (
                                <>
                                    {creationMode === 'zip' ? <Upload size={18} /> : <Play size={18} />}
                                    {creationMode === 'existing' ? 'Importer le serveur' : 'Créer le serveur'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
