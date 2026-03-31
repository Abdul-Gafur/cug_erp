import React from 'react';
import { Head } from '@inertiajs/react';
import FrontendHeader from './FrontendHeader';
import FrontendFooter from './FrontendFooter';
import { getImagePath } from '@/utils/helpers';

interface FrontendLayoutProps {
    children: React.ReactNode;
    title: string;
    description?: string;
    userSlug?: string;
    brandSettings: {
        logo?: string;
        favicon?: string;
        titleText?: string;
        footerText?: string;
    };
    currentPage?: string;
}

export default function FrontendLayout({ children, title, description = 'Find your dream job with us', userSlug, brandSettings, currentPage }: FrontendLayoutProps) {
    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Head title={`${brandSettings.titleText || 'Careers'} - ${title}`}>
                <meta name="description" content={description} />
                {brandSettings.favicon && <link rel="icon" href={getImagePath(brandSettings.favicon)} />}
            </Head>

            <FrontendHeader userSlug={userSlug} brandSettings={brandSettings} currentPage={currentPage} />

            <main className="flex-1">
                {children}
            </main>

            <FrontendFooter userSlug={userSlug} brandSettings={brandSettings} />
        </div>
    );
}