export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-enter pointer-events-auto min-w-[300px] flex items-center p-4 rounded-lg shadow-lg text-white';
    
    let icon = '';
    if (type === 'success') {
        toast.classList.add('bg-green-600');
        icon = '<i class="fas fa-check-circle text-xl mr-3"></i>';
    } else if (type === 'error') {
        toast.classList.add('bg-red-600');
        icon = '<i class="fas fa-exclamation-circle text-xl mr-3"></i>';
    } else {
        toast.classList.add('bg-blue-600');
        icon = '<i class="fas fa-info-circle text-xl mr-3"></i>';
    }

    toast.innerHTML = `
        ${icon}
        <div class="flex-1 font-medium">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}
