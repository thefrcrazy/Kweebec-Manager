import { useState, useEffect } from 'react';
import { Save, FolderOpen, AlertTriangle, Palette, Check, Image, FolderSearch, Upload } from 'lucide-react';
import DirectoryPicker from '../components/DirectoryPicker';

interface PanelInfo {
    version: string;
    servers_dir: string;
    backups_dir: string;
    database_path: string;
    is_docker: boolean;
}

interface LoginCustomization {
    default_color: string;
    background_url: string;
}

const PRESET_COLORS = [
    '#3A82F6', // Default Blue
    '#FF591E', // Mistral Orange
    '#6366F1', // Indigo
    '#ec4899', // Pink
    '#10B981', // Emerald
    '#F59E0B', // Amber
];

import { useLanguage } from '../contexts/LanguageContext';

export default function PanelSettings() {
    const { t } = useLanguage();
    const [webhookUrl, setWebhookUrl] = useState('');
    const [panelInfo, setPanelInfo] = useState<PanelInfo>({
        version: '0.1.0',
        servers_dir: './servers',
        backups_dir: './backups',
        database_path: 'kweebec.db',
        is_docker: false
    });
    const [loginCustomization, setLoginCustomization] = useState<LoginCustomization>({
        default_color: '#3A82F6',
        background_url: ''
    });
    const [serversDir, setServersDir] = useState('');
    const [backupsDir, setBackupsDir] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveMessage, setSaveMessage] = useState('Paramètres sauvegardés avec succès !');
    const [isLoading, setIsLoading] = useState(true);
    const [showServersDirPicker, setShowServersDirPicker] = useState(false);
    const [showBackupsDirPicker, setShowBackupsDirPicker] = useState(false);
    const [isTestingWebhook, setIsTestingWebhook] = useState(false);
    const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleTestWebhook = async () => {
        setIsTestingWebhook(true);
        setWebhookTestResult(null);

        try {
            const response = await fetch('/api/v1/webhook/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ webhook_url: webhookUrl }),
            });

            if (response.ok) {
                setWebhookTestResult({ success: true, message: '✅ Webhook envoyé avec succès !' });
            } else {
                const data = await response.json();
                setWebhookTestResult({ success: false, message: data.error || t('common.error') });
            }
        } catch (error) {
            setWebhookTestResult({ success: false, message: t('common.error') });
        } finally {
            setIsTestingWebhook(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Veuillez sélectionner une image valide');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('L\'image ne doit pas dépasser 5 Mo');
            return;
        }

        setIsUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/v1/upload/image', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                setLoginCustomization(prev => ({ ...prev, background_url: data.url }));
            } else {
                const errorData = await response.json();
                alert(errorData.error || 'Erreur lors de l\'upload');
            }
        } catch (error) {
            alert('Erreur de connexion au serveur');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/v1/settings', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setPanelInfo({
                    version: data.version || '0.1.0',
                    servers_dir: data.servers_dir || './servers',
                    backups_dir: data.backups_dir || './backups',
                    database_path: data.database_path || 'kweebec.db',
                    is_docker: data.is_docker || false
                });
                setServersDir(data.servers_dir || './data/servers');
                setBackupsDir(data.backups_dir || './data/backups');
                setWebhookUrl(data.webhook_url || '');
                setLoginCustomization({
                    default_color: data.login_default_color || '#3A82F6',
                    background_url: data.login_background_url || ''
                });
            }
        } catch (error) {
            console.error('Erreur:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        try {
            const response = await fetch('/api/v1/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    webhook_url: webhookUrl,
                    servers_dir: panelInfo.is_docker ? undefined : serversDir,
                    backups_dir: panelInfo.is_docker ? undefined : backupsDir,
                    login_default_color: loginCustomization.default_color,
                    login_background_url: loginCustomization.background_url
                }),
            });

            if (response.ok) {
                setSaveMessage(t('panel_settings.save_success'));
                setSaveSuccess(true);
                fetchSettings();
                setTimeout(() => setSaveSuccess(false), 5000);
            }
        } catch (error) {
            console.error('Erreur:', error);
        } finally {
            setIsSaving(false);
        }
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
                    <h1 className="page-header__title">{t('panel_settings.title')}</h1>
                    <p className="page-header__subtitle">{t('panel_settings.subtitle')}</p>
                </div>
            </div>

            <div className="settings-grid">
                {/* Discord Notifications */}
                <div className="card">
                    <h3 className="settings-section__title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                        </svg>
                        {t('panel_settings.discord_title')}
                    </h3>

                    <p className="form-hint" style={{ marginBottom: '1rem' }}>
                        Configuration globale des notifications Discord pour tous les serveurs.
                    </p>

                    <div className="form-group">
                        <label className="form-label">{t('panel_settings.webhook_url')}</label>
                        <input
                            type="text"
                            placeholder="https://discord.com/api/webhooks/..."
                            className="form-input"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                        />
                        <p className="form-hint">
                            Recevez des notifications pour : démarrage/arrêt de serveurs, création de backups, alertes système.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={handleTestWebhook}
                        disabled={!webhookUrl || isTestingWebhook}
                    >
                        {isTestingWebhook ? t('panel_settings.test_success') : t('panel_settings.test_webhook')}
                    </button>
                    {webhookTestResult && (
                        <p className={`form-hint ${webhookTestResult.success ? 'text-success' : 'text-danger'}`} style={{ marginTop: '0.5rem' }}>
                            {webhookTestResult.message}
                        </p>
                    )}
                </div>

                {/* Chemin des répertoires */}
                <div className="card">
                    <h3 className="settings-section__title">
                        <FolderOpen size={20} />
                        {t('panel_settings.general_title')}
                    </h3>

                    {panelInfo.is_docker && (
                        <div className="alert alert--info" style={{ marginBottom: '1rem' }}>
                            <AlertTriangle size={16} />
                            <span>Les chemins sont gérés par Docker et ne peuvent pas être modifiés.</span>
                        </div>
                    )}

                    <div className="info-list">
                        <div className="info-list__item info-list__item--editable">
                            <span className="info-list__label">{t('panel_settings.servers_path')}</span>
                            {panelInfo.is_docker ? (
                                <span className="info-list__value info-list__value--mono">{panelInfo.servers_dir}</span>
                            ) : (
                                <div className="info-list__input-group">
                                    <input
                                        type="text"
                                        className="form-input form-input--inline"
                                        value={serversDir}
                                        onChange={(e) => setServersDir(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn--secondary btn--sm"
                                        onClick={() => setShowServersDirPicker(true)}
                                        title="Parcourir"
                                    >
                                        <FolderSearch size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="info-list__item info-list__item--editable">
                            <span className="info-list__label">{t('panel_settings.backups_path')}</span>
                            {panelInfo.is_docker ? (
                                <span className="info-list__value info-list__value--mono">{panelInfo.backups_dir}</span>
                            ) : (
                                <div className="info-list__input-group">
                                    <input
                                        type="text"
                                        className="form-input form-input--inline"
                                        value={backupsDir}
                                        onChange={(e) => setBackupsDir(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn--secondary btn--sm"
                                        onClick={() => setShowBackupsDirPicker(true)}
                                        title="Parcourir"
                                    >
                                        <FolderSearch size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Personnalisation de la page de connexion */}
                <div className="card">
                    <h3 className="settings-section__title">
                        <Palette size={20} />
                        {t('panel_settings.appearance_title')}
                    </h3>

                    <p className="form-hint" style={{ marginBottom: '1rem' }}>
                        Ces paramètres s'appliquent à tous les nouveaux utilisateurs par défaut.
                    </p>

                    <div className="form-group">
                        <label className="form-label">Couleur par défaut</label>
                        <div className="color-picker">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setLoginCustomization(prev => ({ ...prev, default_color: color }))}
                                    className={`color-picker__swatch ${loginCustomization.default_color.toLowerCase() === color.toLowerCase() ? 'color-picker__swatch--active' : ''}`}
                                    style={{
                                        background: color,
                                        boxShadow: loginCustomization.default_color.toLowerCase() === color.toLowerCase()
                                            ? `0 0 15px ${color}66`
                                            : 'none'
                                    }}
                                >
                                    {loginCustomization.default_color.toLowerCase() === color.toLowerCase() && (
                                        <Check size={20} color="white" strokeWidth={3} />
                                    )}
                                </button>
                            ))}

                            <div className="color-picker__custom">
                                <input
                                    type="color"
                                    value={loginCustomization.default_color}
                                    onChange={(e) => setLoginCustomization(prev => ({ ...prev, default_color: e.target.value }))}
                                    title="Couleur personnalisée"
                                />
                            </div>
                        </div>
                        <p className="form-hint">
                            Cette couleur sera utilisée comme couleur d'accentuation par défaut pour les nouveaux utilisateurs.
                        </p>
                    </div>



                    <div className="form-group">
                        <label className="form-label">
                            <Image size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            Image de fond
                        </label>
                        <div className="info-list__input-group">
                            <input
                                type="url"
                                placeholder="https://example.com/background.jpg"
                                className="form-input form-input--inline"
                                value={loginCustomization.background_url}
                                onChange={(e) => setLoginCustomization(prev => ({ ...prev, background_url: e.target.value }))}
                            />
                            <div className="file-upload-wrapper">
                                <input
                                    type="file"
                                    id="bg-upload"
                                    accept="image/*"
                                    className="file-input"
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                />
                                <label
                                    htmlFor="bg-upload"
                                    className={`btn btn--secondary btn--sm ${isUploadingImage ? 'btn--loading' : ''}`}
                                    title="Uploader une image"
                                >
                                    {isUploadingImage ? (
                                        <div className="spinner-sm"></div>
                                    ) : (
                                        <Upload size={16} />
                                    )}
                                </label>
                            </div>
                        </div>
                        <p className="form-hint">
                            URL d'une image à utiliser comme fond sur la page de connexion. Laissez vide pour le fond par défaut.
                        </p>
                    </div>

                    {loginCustomization.background_url && (
                        <div className="login-preview">
                            <label className="form-label">Aperçu</label>
                            <div
                                className="login-preview__image"
                                style={{
                                    backgroundImage: `url(${loginCustomization.background_url})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    height: '120px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)'
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Save Button */}
                {saveSuccess && (
                    <div className={`alert ${saveMessage.includes('Redémarrez') ? 'alert--warning' : 'alert--success'}`}>
                        {saveMessage}
                    </div>
                )}

                <button className="btn btn--primary btn--lg" onClick={handleSave} disabled={isSaving}>
                    <Save size={18} />
                    {isSaving ? t('common.save') : t('common.save')}
                </button>
            </div>

            {/* Directory Pickers */}
            <DirectoryPicker
                isOpen={showServersDirPicker}
                onClose={() => setShowServersDirPicker(false)}
                onSelect={(path) => setServersDir(path)}
                initialPath={serversDir || '/'}
                title="Sélectionner le répertoire des serveurs"
            />

            <DirectoryPicker
                isOpen={showBackupsDirPicker}
                onClose={() => setShowBackupsDirPicker(false)}
                onSelect={(path) => setBackupsDir(path)}
                initialPath={backupsDir || '/'}
                title="Sélectionner le répertoire des backups"
            />
        </div >
    );
}
