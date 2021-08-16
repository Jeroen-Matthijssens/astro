import type { AstroConfig } from './@types/astro';
import path from 'path';
import { existsSync } from 'fs';
import getPort from 'get-port';

/** Type util */
const type = (thing: any): string => (Array.isArray(thing) ? 'Array' : typeof thing);

/** Throws error if a user provided an invalid config. Manually-implemented to avoid a heavy validation library. */
function validateConfig(config: any): void {
  // basic
  if (config === undefined || config === null) throw new Error(`[config] Config empty!`);
  if (typeof config !== 'object') throw new Error(`[config] Expected object, received ${typeof config}`);

  // strings
  for (const key of ['projectRoot', 'pages', 'dist']) {
    if (config[key] !== undefined && config[key] !== null && typeof config[key] !== 'string') {
      throw new Error(`[config] ${key}: ${JSON.stringify(config[key])}\n  Expected string, received ${type(config[key])}.`);
    }
  }

  // booleans
  for (const key of ['sitemap']) {
    if (config[key] !== undefined && config[key] !== null && typeof config[key] !== 'boolean') {
      throw new Error(`[config] ${key}: ${JSON.stringify(config[key])}\n  Expected boolean, received ${type(config[key])}.`);
    }
  }

  // public directories
  if (config['public'] != undefined && config['public'] != null && typeof config['public'] !== 'string' && !Array.isArray(config['public'])) {
    throw new Error(`[config] public: ${JSON.stringify(config['public'])}\n Expected string or array, recieved ${type(config['public'])}'`);
  }

  // buildOptions
  if (config.buildOptions) {
    // buildOptions.site
    if (config.buildOptions.site !== undefined) {
      if (typeof config.buildOptions.site !== 'string') throw new Error(`[config] buildOptions.site is not a string`);
      try {
        new URL(config.buildOptions.site);
      } catch (err) {
        throw new Error('[config] buildOptions.site must be a valid URL');
      }
    }
  }

  // devOptions
  if (typeof config.devOptions?.port !== 'number') {
    throw new Error(`[config] devOptions.port: Expected number, received ${type(config.devOptions?.port)}`);
  }
  if (typeof config.devOptions?.hostname !== 'string') {
    throw new Error(`[config] devOptions.hostname: Expected string, received ${type(config.devOptions?.hostname)}`);
  }
  if (config.devOptions?.tailwindConfig !== undefined && typeof config.devOptions?.tailwindConfig !== 'string') {
    throw new Error(`[config] devOptions.tailwindConfig: Expected string, received ${type(config.devOptions?.tailwindConfig)}`);
  }
}

/** Set default config values */
async function configDefaults(userConfig?: any): Promise<any> {
  const config: any = { ...(userConfig || {}) };

  if (!config.projectRoot) config.projectRoot = '.';
  if (!config.src) config.src = './src';
  if (!config.pages) config.pages = './src/pages';
  if (!config.dist) config.dist = './dist';
  if (!config.public) config.public = './public';
  if (!config.devOptions) config.devOptions = {};
  if (!config.devOptions.port) config.devOptions.port = await getPort({ port: getPort.makeRange(3000, 3050) });
  if (!config.devOptions.hostname) config.devOptions.hostname = 'localhost';
  if (!config.buildOptions) config.buildOptions = {};
  if (!config.markdownOptions) config.markdownOptions = {};
  if (typeof config.buildOptions.sitemap === 'undefined') config.buildOptions.sitemap = true;

  return config;
}

/** Turn raw config values into normalized values */
function normalizeConfig(userConfig: any, root: string): AstroConfig {
  const config: any = { ...(userConfig || {}) };

  const fileProtocolRoot = `file://${root}/`;
  config.projectRoot = new URL(config.projectRoot + '/', fileProtocolRoot);
  config.src = new URL(config.src + '/', fileProtocolRoot);
  config.pages = new URL(config.pages + '/', fileProtocolRoot);
  config.public = !Array.isArray(config.public) ? [new URL(config.public + '/', fileProtocolRoot)] : config.public.map((dir: String) => new URL(dir + '/', fileProtocolRoot));

  return config as AstroConfig;
}

/** Attempt to load an `astro.config.mjs` file */
export async function loadConfig(rawRoot: string | undefined, configFileName = 'astro.config.mjs'): Promise<AstroConfig> {
  const root = rawRoot ? path.resolve(rawRoot) : process.cwd();
  const astroConfigPath = new URL(`./${configFileName}`, `file://${root}/`);

  // load
  let config: any;
  if (existsSync(astroConfigPath)) {
    config = await configDefaults((await import(astroConfigPath.href)).default);
  } else {
    config = await configDefaults();
  }

  // validate
  validateConfig(config);

  // normalize
  config = normalizeConfig(config, root);

  return config as AstroConfig;
}
