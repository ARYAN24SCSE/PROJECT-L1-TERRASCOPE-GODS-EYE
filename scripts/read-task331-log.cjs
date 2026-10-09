const fs = require('fs');
const logPath = 'C:/Users/LENOVO/.gemini/antigravity-ide/brain/817621c9-64f1-4dde-915c-ad61ee56c90d/.system_generated/tasks/task-331.log';
if (fs.existsSync(logPath)) {
  console.log(fs.readFileSync(logPath, 'utf8'));
} else {
  console.log('Log file not found yet');
}
