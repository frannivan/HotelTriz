module.exports = {
  apps: [
    {
      name: "hoteltriz-backend",
      script: "server/src/index.js",
      watch: false,
      env: {
        PORT: 3001,
        NODE_ENV: "production",
        // Aquí deberás poner tus llaves secretas en Ubuntu
        // DATABASE_URL: "file:./prisma/dev.db" 
        // STRIPE_SECRET_KEY: "sk_live_..."
      }
    },
    {
      name: "hoteltriz-frontend",
      script: "npm",
      args: "run preview --prefix client",
      watch: false,
      env: {
        PORT: 3000,
        NODE_ENV: "production"
      }
    }
  ]
};
