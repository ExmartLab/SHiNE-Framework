// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';
import { execSync } from 'child_process';
import path from 'path';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// Pre-build schema resolution
try {
  execSync('node scripts/resolveSchemas.js', {
    cwd: __dirname,
    stdio: 'inherit'
  });
} catch (error) {
  console.warn('⚠️  Schema resolution failed:', error.message);
  console.warn('Proceeding with build - schemas may not display properly in LLMS.txt');
}

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Study Platform Documentation',
  tagline: 'V-SHINE',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://exmartlab.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/SHiNE-Framework/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'ExmartLab', // Usually your GitHub org/user name.
  projectName: 'SHiNE-Framework', // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [
    [
      '@signalwire/docusaurus-plugin-llms-txt',
      {
        depth: 3,
        content: {
          enableLlmsFullTxt: true,
          relativePaths: false
        }
      },
    ],
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
      ({
        hashed: true,
        docsRouteBasePath: '/',
        language: "en",
      }),
    ]
  ],

  themes: ["docusaurus-json-schema-plugin"],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/'
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      navbar: {
        title: 'V-SHINE',
        logo: {
          alt: 'V-SHINE Logo',
          src: 'img/smart_home.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Tutorial',
          },
          {
            href: 'https://github.com/ExmartLab/SHiNE-Framework',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorial',
                to: '/',
              }
            ]
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} V-SHINE`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
