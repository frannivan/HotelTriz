module.exports = {
  apps: [
    {
      name: "hoteltriz-backend",
      script: "src/index.js",
      cwd: "./server",
      watch: false,
      env: {
        PORT: 3031, // Puerto Seguro Asignado
        NODE_ENV: "production",
      }
    },
    {
      name: "hoteltriz-frontend",
      script: "node_modules/vite/bin/vite.js",
      args: "preview --port 3030 --host",
      cwd: "./client",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
