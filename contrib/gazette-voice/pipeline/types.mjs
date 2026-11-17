// @ts-check
/**
 * Shared shapes for the pipeline (JSDoc only; no runtime code beyond the constants).
 *
 * @typedef {import('../../_sdk/types').Lang} Lang
 * @typedef {import('../../_sdk/types').PipelineDeps} PipelineDeps
 * @typedef {import('../../_sdk/types').Net} Net
 *
 * @typedef {Object} Term
 * @property {string} name
 * @property {string} slug
 * @property {string[]} [aliases]
 * @property {number|null} [curatorLevel]  1..4 when a curator set it (term_level_audit), else null
 * @property {Level|null} [savedLabel]     the Gazette label saved earlier, if any
 * @property {string|null} [hook]          one-line explainer
 * @property {string|null} [urName]        Urdu name, when translated
 * @property {number} [salience]
 *
 * @typedef {'easy'|'advanced'|'expert'} Level
 *
 * @typedef {Object} Paper
 * @property {string} id                  ilm.red book id
 * @property {number} n                   number in the edition (1 based)
 * @property {string|null} arxivId
 * @property {string|null} [doi]
 * @property {string} title
 * @property {string[]} authors
 * @property {string} abstract
 * @property {string|null} [notes]        ilm.red's own brief or summary
 * @property {string} url                 canonical paper link (arXiv abs or publisher)
 * @property {string} path                ilm.red book path
 * @property {string} [topic]             search phrase for topic coverage; defaults to the title
 * @property {Term[]} terms
 *
 * @typedef {'hn'|'hf'|'s2'|'news'|'github'|'youtube'} Source
 *
 * @typedef {Object} CoverageItem
 * @property {Source} source
 * @property {'discussion'|'votes'|'citations'|'news'|'code'|'video'|'paper'} kind
 * @property {string} url                 the link a reader would open
 * @property {string} title
 * @property {string} [snippet]
 * @property {string} [linksTo]           for a discussion: the page the thread is about (may also be linked)
 * @property {string} [outlet]
 * @property {number} [points]
 * @property {number} [comments]
 * @property {number} [stars]
 * @property {number} [count]
 * @property {string|null} [publishedAt]
 * @property {boolean} exact              matched by id or exact URL
 * @property {boolean} weak               matched by words only; Scout must confirm
 *
 * @typedef {Object} KeptSource
 * @property {CoverageItem} item
 * @property {string} kind
 * @property {string} adds
 * @property {string} stance
 * @property {boolean} notable
 *
 * @typedef {Object} Story
 * @property {number} paper
 * @property {string} headline
 * @property {string} dept
 * @property {string} body
 * @property {string} question
 */
export const LEVELS = /** @type {const} */ (['easy', 'advanced', 'expert']);
