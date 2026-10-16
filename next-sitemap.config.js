/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://quiricostudios.com',
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  exclude: [
    '/portal/*',
    '/admin/*',
    '/acceder/*',
    '/sign-in',
    '/sign-up',
    '/sso-callback',
    '/api/*',
    '/billing/*',
    '/facturacion/*',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/portal/', '/admin/', '/api/', '/acceder/'],
      },
      { userAgent: 'Googlebot', allow: '/' },
    ],
  },
};
