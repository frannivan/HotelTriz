module.exports = {
  apps: [
    {
      name: "hoteltriz-backend",
      script: "server/src/index.js",
      watch: false,
      env: {
        PORT: 3031, // Puerto Seguro Asignado
        NODE_ENV: "production",
      }
    },
    {
      name: "hoteltriz-frontend",
      script: "npm",
      args: "run preview --prefix client -- --port 3030 --host", // Forzamos a Vite a usar 3030
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
