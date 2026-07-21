import { checkAndRunMonthlyClosure } from './autoStockCalculationService.js';

class SchedulerService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
    }

    // Start the scheduler
    start() {
        if (this.isRunning) {
            console.log('⚠️  Scheduler is already running');
            return;
        }

        console.log('🚀 Starting Scheduler Service...');
        this.isRunning = true;

        // Check every hour if it's time to run monthly closure
        this.intervalId = setInterval(() => {
            try {
                checkAndRunMonthlyClosure();
            } catch (error) {
                console.error('❌ Error in scheduler:', error);
            }
        }, 60 * 60 * 1000); // Check every hour

        console.log('✅ Scheduler Service started - checking every hour');
    }

    // Stop the scheduler
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Scheduler is not running');
            return;
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isRunning = false;
        console.log('🛑 Scheduler Service stopped');
    }

    // Get scheduler status
    getStatus() {
        return {
            isRunning: this.isRunning,
            nextCheck: this.isRunning ? 'Every hour' : 'Not running'
        };
    }
}

// Create singleton instance
const schedulerService = new SchedulerService();

export default schedulerService;
