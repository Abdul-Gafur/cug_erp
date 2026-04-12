import { useState } from 'react';
import { router } from '@inertiajs/react';

interface UseDeleteHandlerOptions {
    routeName: string;
    defaultMessage?: string;
    onSuccess?: (response?: any) => void;
    onError?: (error: any) => void;
}

export const useDeleteHandler = (options: UseDeleteHandlerOptions) => {
    const {
        routeName,
        defaultMessage = 'Are you sure you want to delete this item?',
        onSuccess,
        onError
    } = options || {};

    const [deleteState, setDeleteState] = useState<{
        isOpen: boolean;
        id: any;
        message: string;
    }>({
        isOpen: false,
        id: null,
        message: defaultMessage
    });

    const openDeleteDialog = (id: any, message?: string) => {
        setDeleteState({
            isOpen: true,
            id,
            message: message || defaultMessage
        });
    };

    const closeDeleteDialog = () => {
        setDeleteState({
            isOpen: false,
            id: null,
            message: defaultMessage
        });
    };

    const confirmDelete = () => {
        if (deleteState.id) {
            router.delete(route(routeName, deleteState.id), {
                onSuccess: (response) => {
                    closeDeleteDialog();
                    onSuccess?.(response);
                },
                onError
            });
        }
    };

    return {
        deleteState,
        openDeleteDialog,
        closeDeleteDialog,
        confirmDelete
    };
};