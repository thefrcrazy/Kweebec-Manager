import { useState, useEffect } from 'react';
import { Check, HardDrive, Palette, User, ArrowRight, ArrowLeft, FolderSearch } from 'lucide-react';
import DirectoryPicker from '../components/DirectoryPicker';
import '../styles/pages/_login.scss';

const PRESET_COLORS = [
    '#3A82F6', // Default Blue
    '#FF591E', // Mistral
    '#6366F1', // Indigo
    '#10B981', // Emerald
    '#F59E0B', // Amber
];

const STEPS = [
    { id: 1, key: 'step1', icon: User },
    { id: 2, key: 'step2', icon: HardDrive },
    { id: 3, key: 'step3', icon: Palette },
    { id: 4, key: 'step4', icon: Check },
];

import { useLanguage } from '../contexts/LanguageContext';

export default function Setup() {
    const { t } = useLanguage();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        username: 'admin',
        password: '',
        servers_dir: './data/servers',
        backups_dir: './data/backups',
        theme_color: '#3A82F6'
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showServersDirPicker, setShowServersDirPicker] = useState(false);
    const [showBackupsDirPicker, setShowBackupsDirPicker] = useState(false);

    // Apply theme color in real-time when selected
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--color-accent', formData.theme_color);
        // Convert hex to rgb for opacity support
        const r = parseInt(formData.theme_color.slice(1, 3), 16);
        const g = parseInt(formData.theme_color.slice(3, 5), 16);
        const b = parseInt(formData.theme_color.slice(5, 7), 16);
        root.style.setProperty('--color-accent-rgb', `${r}, ${g}, ${b}`);
    }, [formData.theme_color]);

    const nextStep = () => {
        if (currentStep === 1 && formData.password.length < 8) {
            setError(t('user_settings.password_min_length'));
            return;
        }
        setError('');
        setCurrentStep(prev => Math.min(prev + 1, 4));
    };

    const prevStep = () => {
        setError('');
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/v1/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token);
                window.location.href = '/';
            } else {
                const err = await response.json();
                setError(err.error || t('common.error'));
            }
        } catch (e) {
            setError(t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="setup-wizard" style={{
                width: '100%',
                maxWidth: '700px',
                padding: '3rem',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)'
            }}>
                {/* Logo centré et plus gros */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img
                        src="/kweebec-manager-logo.png"
                        alt="Kweebec Manager"
                        style={{ height: '100px', marginBottom: '1rem' }}
                    />
                    <h1 style={{
                        fontSize: '1.75rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        marginBottom: '0.5rem'
                    }}>
                        {t('setup.title')}
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
                        {t('setup.subtitle')}
                    </p>
                </div>

                {/* Stepper */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginBottom: '2.5rem'
                }}>
                    {STEPS.map((step, index) => {
                        const StepIcon = step.icon;
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;

                        return (
                            <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: isCompleted
                                            ? 'var(--color-accent)'
                                            : isActive
                                                ? 'var(--color-accent)'
                                                : 'var(--color-bg-tertiary)',
                                        color: isActive || isCompleted ? 'white' : 'var(--color-text-muted)',
                                        transition: 'all 0.3s ease',
                                        border: isActive ? '2px solid var(--color-accent)' : '2px solid transparent'
                                    }}>
                                        {isCompleted ? <Check size={18} /> : <StepIcon size={18} />}
                                    </div>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                        fontWeight: isActive ? 600 : 400
                                    }}>
                                        {t(`setup.${step.key}`)}
                                    </span>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div style={{
                                        width: '40px',
                                        height: '2px',
                                        background: isCompleted ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                                        marginLeft: '0.5rem',
                                        marginRight: '0.5rem',
                                        marginBottom: '1.5rem'
                                    }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {error && (
                    <div className="alert alert--danger" style={{ marginBottom: '1.5rem' }}>
                        {error}
                    </div>
                )}

                {/* Step Content */}
                <div style={{ minHeight: '200px' }}>
                    {currentStep === 1 && (
                        <div className="step-content">
                            <h3 style={{
                                fontSize: '1.1rem',
                                marginBottom: '1.5rem',
                                color: 'var(--color-text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <User size={20} className="text-accent" />
                                {t('setup.create_admin')}
                            </h3>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">{t('setup.username')}</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('setup.password')}</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Minimum 8 caractères"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="step-content">
                            <h3 style={{
                                fontSize: '1.1rem',
                                marginBottom: '1.5rem',
                                color: 'var(--color-text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <HardDrive size={20} className="text-accent" />
                                {t('setup.step2')}
                            </h3>
                            <p style={{
                                color: 'var(--color-text-secondary)',
                                fontSize: '0.9rem',
                                marginBottom: '1.5rem'
                            }}>
                                Ces chemins définissent où seront stockés vos serveurs et sauvegardes.
                            </p>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">{t('setup.servers_dir')}</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.servers_dir}
                                        onChange={e => setFormData({ ...formData, servers_dir: e.target.value })}
                                        required
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn--secondary"
                                        onClick={() => setShowServersDirPicker(true)}
                                        title="Parcourir"
                                    >
                                        <FolderSearch size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('setup.backups_dir')}</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.backups_dir}
                                        onChange={e => setFormData({ ...formData, backups_dir: e.target.value })}
                                        required
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn--secondary"
                                        onClick={() => setShowBackupsDirPicker(true)}
                                        title="Parcourir"
                                    >
                                        <FolderSearch size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="step-content">
                            <h3 style={{
                                fontSize: '1.1rem',
                                marginBottom: '1.5rem',
                                color: 'var(--color-text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <Palette size={20} className="text-accent" />
                                {t('setup.theme_title')}
                            </h3>
                            <div style={{
                                display: 'flex',
                                gap: '12px',
                                flexWrap: 'wrap',
                                justifyContent: 'center'
                            }}>
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, theme_color: color }))}
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            background: color,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: formData.theme_color.toLowerCase() === color.toLowerCase()
                                                ? `0 0 0 3px var(--color-bg-primary), 0 0 0 5px ${color}`
                                                : '0 2px 8px rgba(0,0,0,0.3)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {formData.theme_color.toLowerCase() === color.toLowerCase() && (
                                            <Check size={24} color="white" strokeWidth={3} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="step-content">
                            <h3 style={{
                                fontSize: '1.1rem',
                                marginBottom: '1.5rem',
                                color: 'var(--color-text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <Check size={20} className="text-accent" />
                                {t('setup.step4')}
                            </h3>
                            <div style={{
                                background: 'var(--color-bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{t('setup.summary_user')}</span>
                                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{formData.username}</span>
                                </div>
                                <div style={{ height: '1px', background: 'var(--color-border)' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{t('setup.summary_servers')}</span>
                                    <code style={{
                                        color: 'var(--color-accent)',
                                        background: 'var(--color-bg-secondary)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.85rem'
                                    }}>{formData.servers_dir}</code>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{t('setup.summary_backups')}</span>
                                    <code style={{
                                        color: 'var(--color-accent)',
                                        background: 'var(--color-bg-secondary)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.85rem'
                                    }}>{formData.backups_dir}</code>
                                </div>
                                <div style={{ height: '1px', background: 'var(--color-border)' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{t('setup.summary_theme')}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            background: formData.theme_color
                                        }} />
                                        <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                                            {formData.theme_color}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation Buttons */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '2rem',
                    gap: '1rem'
                }}>
                    {currentStep > 1 ? (
                        <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={prevStep}
                            style={{ flex: 1 }}
                        >
                            <ArrowLeft size={18} style={{ marginRight: '8px' }} />
                            {t('setup.prev')}
                        </button>
                    ) : (
                        <div style={{ flex: 1 }} />
                    )}

                    {currentStep < 4 ? (
                        <button
                            type="button"
                            className="btn btn--primary"
                            onClick={nextStep}
                            style={{ flex: 1 }}
                        >
                            {t('setup.next')}
                            <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="btn btn--primary"
                            onClick={handleSubmit}
                            disabled={isLoading}
                            style={{ flex: 1 }}
                        >
                            {isLoading ? (
                                <div className="spinner-sm" />
                            ) : (
                                <>
                                    {t('setup.finish')}
                                    <Check size={18} style={{ marginLeft: '8px' }} />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Directory Pickers */}
            <DirectoryPicker
                isOpen={showServersDirPicker}
                onClose={() => setShowServersDirPicker(false)}
                onSelect={(path) => setFormData(prev => ({ ...prev, servers_dir: path }))}
                initialPath="/"
                title="Sélectionner le répertoire des serveurs"
            />
            <DirectoryPicker
                isOpen={showBackupsDirPicker}
                onClose={() => setShowBackupsDirPicker(false)}
                onSelect={(path) => setFormData(prev => ({ ...prev, backups_dir: path }))}
                initialPath="/"
                title={t('setup.backups_dir')} // Title is passed, picker might not be translated inside, but title helps
            />
        </div>
    );
}
