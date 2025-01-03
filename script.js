// Load credentials from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedClientId = localStorage.getItem('clientId');
    const savedClientSecret = localStorage.getItem('clientSecret');

    if (savedClientId) {
        document.getElementById('clientId').value = savedClientId;
    }

    if (savedClientSecret) {
        document.getElementById('clientSecret').value = savedClientSecret;
    }

    // Automatically show the Fetch Data button if credentials are saved
    if (savedClientId && savedClientSecret) {
        const fetchDataButton = document.getElementById('fetchDataButton');
        fetchDataButton.style.display = 'block';
    }

    // Check notification permissions
    document.getElementById('enableNotificationsButton').addEventListener('click', () => {
        requestNotificationPermission();
    });

    checkNotificationPermission();
});

function checkNotificationPermission() {
    // Check the saved notification state from localStorage
    const notificationStatus = localStorage.getItem('notificationStatus');

    console.log("Current Notification.permission value:", Notification.permission);
    console.log("Stored notificationStatus in localStorage:", notificationStatus);

    switch (Notification.permission) {
        case "granted":
            console.log("User has granted notification permissions.");
            localStorage.setItem('notificationStatus', 'granted'); // Save status to localStorage
            break;
        case "denied":
            console.log("User has denied notification permissions.");
            alert(
                "Notifications are blocked. Please enable them in your browser settings for the app to work properly."
            );
            break;
        case "default":
            console.log("User has not responded to the notification prompt.");
            // Allow user to request notifications manually via the button
            break;
    }
}

function requestNotificationPermission() {
    Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
            console.log("User has now allowed notifications.");
            localStorage.setItem('notificationStatus', 'granted'); // Update status
        } else if (permission === "denied") {
            console.log("User has now denied notifications.");
            localStorage.setItem('notificationStatus', 'denied'); // Update status
        } else {
            console.log("User has dismissed the notification prompt.");
            localStorage.setItem('notificationStatus', 'default'); // Update status
        }
    });
}

// Add Fetch Data button event listener
document.getElementById('fetchDataButton').addEventListener('click', () => {
    startLongPolling(); // Start polling for printer status
});

// Handle the form submission
document.getElementById('authForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const clientId = document.getElementById('clientId').value;
    const clientSecret = document.getElementById('clientSecret').value;

    // Save credentials to localStorage
    localStorage.setItem('clientId', clientId);
    localStorage.setItem('clientSecret', clientSecret);

    // Show the "Fetch Data" button
    const fetchDataButton = document.getElementById('fetchDataButton');
    fetchDataButton.style.display = 'block';
});

// Fetch Printers Function
async function fetchPrinters(token) {
    try {
        const response = await fetch('https://api.formlabs.com/developer/v1/printers', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        console.log('API Response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching printers:', error);
        return [];
    }
}

// Map machine_type_id to icons
const machineTypeIcons = {
    "type1": "icon1.png",
    "FORM-2-0": "icons/form2.svg",
    "FORM-3-2": "icons/form3.svg",
    "FORM-4-0": "icons/form4.svg",
    "default": "icons/fallback.svg" // Fallback icon
};

// Display Printers
function displayPrinters(printers) {
    const container = document.getElementById('printerStatus');
    container.innerHTML = '<h2>Printers</h2>';
    printers.forEach(printer => {
        const printerSerial = printer.serial || 'Unknown Serial';
        const printerStatus = printer.printer_status.status || 'Unknown Status';
        const machineType = printer.machine_type_id || 'default';
        const iconUrl = machineTypeIcons[machineType] || machineTypeIcons['default'];

        const printerHtml = `
            <div class="printer-item">
                <img src="${iconUrl}" alt="Machine Icon" class="machine-icon">
                <span>${printerSerial} - ${printerStatus}</span>
            </div>
        `;
        container.innerHTML += printerHtml;
    });
}

// Show Browser Notification
function showNotification(message) {
    if (Notification.permission === 'granted') {
        new Notification('Printer Update', {
            body: message,
            icon: 'icons/formAlertlogo.png',
        });
    }
}

// Long Polling for Printer Status
let previousStatuses = {};

async function startLongPolling() {
    const clientId = localStorage.getItem('clientId');
    const clientSecret = localStorage.getItem('clientSecret');

    // Fetch or Refresh Token
    const token = await getAuthToken(clientId, clientSecret);

    // Start polling
    const poll = async () => {
        const printers = await fetchPrinters(token);

        printers.forEach(printer => {
            const printerSerial = printer.serial || 'Unknown Serial';
            const currentStatus = printer.printer_status.status || 'Unknown Status';

            if (previousStatuses[printerSerial] && previousStatuses[printerSerial] !== currentStatus) {
                showNotification(`${printerSerial} is now: ${currentStatus}`);
            }

            // Update the status cache
            previousStatuses[printerSerial] = currentStatus;
        });

        displayPrinters(printers);

        // Continue polling after a delay
        setTimeout(poll, 60000); // 1-minute polling interval
    };

    poll();
}

// Get Authentication Token
async function getAuthToken(clientId, clientSecret) {
    let storedToken = localStorage.getItem('authToken');
    let tokenExpiry = localStorage.getItem('tokenExpiry');

    if (storedToken && tokenExpiry && new Date().getTime() < tokenExpiry) {
        return storedToken;
    }

    try {
        const response = await fetch('https://api.formlabs.com/developer/v1/o/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            }).toString(),
        });

        const data = await response.json();
        if (data.access_token) {
            localStorage.setItem('authToken', data.access_token);
            const expiryDate = new Date().getTime() + 24 * 60 * 60 * 1000;
            localStorage.setItem('tokenExpiry', expiryDate);
            return data.access_token;
        } else {
            console.error('Authentication failed:', data);
            alert('Authentication failed. Please check your credentials.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching auth token:', error);
        alert('An error occurred while fetching the authentication token.');
        return null;
    }
}
