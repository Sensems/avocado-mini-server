import axios from 'axios';

const healthCheck = async (): Promise<void> => {
  try {
    const response = await axios.get('http://localhost:3000/api/v1/health', {
      timeout: 3000,
    });
    
    if (response.status === 200) {
      console.log('Health check passed');
      process.exit(0);
    } else {
      console.error('Health check failed with status:', response.status);
      process.exit(1);
    }
  } catch (error) {
    console.error('Health check failed:', error.message);
    process.exit(1);
  }
};

healthCheck();