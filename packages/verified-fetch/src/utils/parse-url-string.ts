import { type IPNS, type ResolveProgressEvents } from '@helia/ipns'
import { logger } from '@libp2p/logger'
import { peerIdFromString } from '@libp2p/peer-id'
import { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

const log = logger('helia:verified-fetch:parse-url-string')

export interface ParseUrlStringInput {
  urlString: string
  ipns: IPNS
}
export interface ParseUrlStringOptions extends ProgressOptions<ResolveProgressEvents> {

}

export interface ParsedUrlStringResults {
  protocol: string
  path: string
  cid: CID
  query: Record<string, string>
}

const URL_REGEX = /^(?<protocol>ip[fn]s):\/\/(?<cidOrPeerIdOrDnsLink>[^/$?]+)\/?(?<path>[^$?]*)\??(?<queryString>.*)$/

/**
 * A function that parses ipfs:// and ipns:// URLs, returning an object with easily recognizable properties.
 *
 * After determining the protocol successfully, we process the cidOrPeerIdOrDnsLink:
 * * If it's ipfs, it parses the CID or throws an Aggregate error
 * * If it's ipns, it attempts to resolve the PeerId and then the DNSLink. If both fail, an Aggregate error is thrown.
 *
 */
export async function parseUrlString ({ urlString, ipns }: ParseUrlStringInput, options?: ParseUrlStringOptions): Promise<ParsedUrlStringResults> {
  const match = urlString.match(URL_REGEX)
  if (match == null || match.groups == null) {
    throw new TypeError(`Invalid URL: ${urlString}, please use ipfs:// or ipns:// URLs only.`)
  }
  const { protocol, cidOrPeerIdOrDnsLink, path, queryString } = match.groups

  let cid: CID | null = null
  const errors: Error[] = []
  if (protocol === 'ipfs') {
    try {
      cid = CID.parse(cidOrPeerIdOrDnsLink)
    } catch (err) {
      log.error(err)
      errors.push(new TypeError('Invalid CID for ipfs://<cid> URL'))
    }
  } else {
    // protocol is ipns
    log.trace('Attempting to resolve PeerId for %s', cidOrPeerIdOrDnsLink)
    let peerId = null
    try {
      peerId = peerIdFromString(cidOrPeerIdOrDnsLink)
      // @ts-expect-error - onProgress typing is wrong
      cid = await ipns.resolve(peerId, { onProgress: options?.onProgress })
      log.trace('resolved %s to %c', cidOrPeerIdOrDnsLink, cid)
    } catch (err) {
      if (peerId == null) {
        log.error('Could not parse PeerId string "%s"', cidOrPeerIdOrDnsLink, err)
        errors.push(new TypeError(`Could not parse PeerId in ipns url "${cidOrPeerIdOrDnsLink}", ${(err as Error).message}`))
      } else {
        log.error('Could not resolve PeerId %c', peerId, err)
        errors.push(new TypeError(`Could not resolve PeerId "${cidOrPeerIdOrDnsLink}", ${(err as Error).message}`))
      }
    }

    if (cid == null) {
      log.trace('Attempting to resolve DNSLink for %s', cidOrPeerIdOrDnsLink)
      try {
        // @ts-expect-error - onProgress typing is wrong
        cid = await ipns.resolveDns(cidOrPeerIdOrDnsLink, { onProgress: options?.onProgress })
        log.trace('resolved %s to %c', cidOrPeerIdOrDnsLink, cid)
      } catch (err) {
        log.error('Could not resolve DnsLink for "%s"', cidOrPeerIdOrDnsLink, err)
        errors.push(err as Error)
      }
    }
  }

  if (cid == null) {
    throw new AggregateError(errors, `Invalid resource. Cannot determine CID from URL "${urlString}"`)
  }

  // parse query string
  const query: Record<string, string> = {}
  if (queryString != null && queryString.length > 0) {
    const queryParts = queryString.split('&')
    for (const part of queryParts) {
      const [key, value] = part.split('=')
      query[key] = decodeURIComponent(value)
    }
  }

  return {
    protocol,
    cid,
    path,
    query
  }
}
