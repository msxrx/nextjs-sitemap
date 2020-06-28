import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import {
  IGetPathMap,
  IGetSitemap,
  IGetXmlUrl,
  IPathMap,
  ISitemapSite,
} from './types';

const getUrlWithLocaleSubdomain = (baseUrl: string, lang: string): string => {
  const protocolAndHostname = baseUrl.split('//');
  protocolAndHostname[1] = `${lang}.${protocolAndHostname[1]}`;

  return protocolAndHostname.join('//');
};

const getXmlUrl = ({
  baseUrl,
  url,
  alternateUrls = '',
}: IGetXmlUrl): string => {
  const { pagePath, priority, changefreq } = url;
  const date = format(new Date(), 'yyyy-MM-dd');

  const xmlChangefreq = changefreq
    ? `
        <changefreq>${changefreq}</changefreq>`
    : '';
  const xmlPriority = priority
    ? `
        <priority>${priority}</priority>`
    : '';

  return `
    <url>
        <loc>${baseUrl}${pagePath}</loc>
        <lastmod>${date}</lastmod>${xmlChangefreq}${xmlPriority}${alternateUrls}
    </url>`;
};

const isExcludedExtn = (
  fileExtension: string,
  excludeExtensions: string[],
): boolean =>
  excludeExtensions.some(
    (toIgnoreExtension: string) => toIgnoreExtension === fileExtension,
  );

const isReservedPage = (pageName: string): boolean =>
  pageName.charAt(0) === '_' || pageName.charAt(0) === '.';

const getPathMap = ({
  folderPath,
  rootPath,
  excludeExtns,
  excludeIdx,
}: IGetPathMap): IPathMap => {
  const pagesNames: string[] = fs.readdirSync(folderPath);
  let pathMap: IPathMap = {};

  for (const pageName of pagesNames) {
    if (isReservedPage(pageName)) continue;

    const nextPath = folderPath + path.sep + pageName;
    const isFolder = fs.lstatSync(nextPath).isDirectory();

    if (isFolder) {
      const folderPathMap = getPathMap({
        folderPath: nextPath,
        rootPath,
        excludeExtns,
        excludeIdx,
      });
      pathMap = {
        ...pathMap,
        ...folderPathMap,
      };
      continue;
    }

    const fileExtn = pageName.split('.').pop() ?? '';
    const fileExtnLen = fileExtn.length + 1;
    if (isExcludedExtn(fileExtn, excludeExtns)) continue;

    let fileNameWithoutExtn = pageName.slice(0, pageName.length - fileExtnLen);
    if (excludeIdx && fileNameWithoutExtn === 'index') {
      fileNameWithoutExtn = '';
    }

    const newFolderPath = folderPath.replace(rootPath, '').replace(/\\/g, '/');
    const pagePath = `${newFolderPath}${
      fileNameWithoutExtn ? '/' + fileNameWithoutExtn : ''
    }`;

    pathMap[pagePath] = {
      page: pagePath,
    };
  }

  return pathMap;
};

const getSitemap = async ({
  pathMap,
  include,
  pagesConfig,
  nextConfigPath,
}: IGetSitemap): Promise<ISitemapSite[]> => {
  if (nextConfigPath) {
    let nextConfig = require(nextConfigPath);

    if (typeof nextConfig === 'function') {
      nextConfig = nextConfig([], {});
    }

    if (nextConfig && nextConfig.exportPathMap) {
      const { exportPathMap } = nextConfig;

      try {
        pathMap = await exportPathMap(pathMap, {});
      } catch (err) {
        throw new Error('Export path map: ' + err);
      }
    }
  }

  const paths = [...Object.keys(pathMap), ...include];
  return paths.map(
    (pagePath: string): ISitemapSite => {
      const pageConfig = pagesConfig[pagePath];
      const priority = pageConfig?.priority ?? '';
      const changefreq = pageConfig?.changefreq ?? '';

      return { pagePath, priority, changefreq };
    },
  );
};

export { getUrlWithLocaleSubdomain, getXmlUrl, getPathMap, getSitemap };