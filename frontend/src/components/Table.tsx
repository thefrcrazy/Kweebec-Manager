import { ReactNode } from 'react';

interface TableProps {
    children: ReactNode;
    className?: string;
}

export default function Table({ children, className = '' }: TableProps) {
    return (
        <div className={`card ${className}`} style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
                <table className="table">
                    {children}
                </table>
            </div>
        </div>
    );
}
