module.exports = {
  apps: [
    {
      name: "3pl-web",
      cwd: "/var/www/wms/apps/web",
      script: "npm",
      args: "run start -- -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      autorestart: true,
      watch: false,
      out_file: "/var/log/3pl-web/out.log",
      error_file: "/var/log/3pl-web/error.log",
    },
  ],
};
