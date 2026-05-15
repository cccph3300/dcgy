module.exports = {
  apps: [
    {
      name: 'dcgy',
      script: '.output/server/index.mjs',
      cwd: '/www/wwwroot/dcgy',
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: '3000'
      }
    }
  ]
}
