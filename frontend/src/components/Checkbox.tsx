import React from 'react';

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
    className?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
    checked,
    onChange,
    label,
    description,
    disabled = false,
    className = ''
}) => {
    return (
        <label
            className={`checkbox-component ${className}`}
            style={{
                display: 'flex',
                alignItems: description ? 'flex-start' : 'center',
                gap: '0.75rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: '0.6rem 0.75rem',
                background: 'var(--color-bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.borderColor = 'var(--color-accent)';
            }}
            onMouseLeave={(e) => {
                if (!disabled) e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => !disabled && onChange(e.target.checked)}
                disabled={disabled}
                style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--color-accent)',
                    flexShrink: 0,
                    marginTop: description ? '2px' : 0,
                    cursor: disabled ? 'not-allowed' : 'pointer'
                }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    lineHeight: 1.3,
                    color: 'var(--color-text-primary)'
                }}>
                    {label}
                </span>
                {description && (
                    <span style={{
                        fontSize: '0.7rem',
                        color: 'var(--color-text-muted)',
                        lineHeight: 1.3
                    }}>
                        {description}
                    </span>
                )}
            </div>
        </label>
    );
};

export default Checkbox;
