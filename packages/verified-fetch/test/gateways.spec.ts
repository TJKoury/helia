import { createKuboNode } from './fixtures/create-kubo.js'
import { createVerifiedFetch } from '../src/index.js'
import { expect } from 'aegir/chai'
import type { Controller } from 'ipfsd-ctl'
import { addContentToKuboNode } from './fixtures/add-content-to-kubo-node.js'
import { UnixFS } from 'ipfs-unixfs'

describe('verified-fetch gateways', () => {
  let controller: Controller<'go'>
  beforeEach(async () => {
    controller = await createKuboNode()
    await controller.start()
  })

  afterEach(async () => {
    await controller.stop()
  })

  it('Uses the provided gateway', async () => {
    const verifiedFetch = await createVerifiedFetch({
      gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`],
    })
    const givenString = 'hello sgtpooki from verified-fetch test'
    const content = new UnixFS({ type: 'raw', data: Buffer.from(givenString) })
    const {cid} = await addContentToKuboNode(controller, content.marshal())
    expect(cid).to.be.ok()
    // @ts-expect-error - todo fix types
    const resp = await verifiedFetch(cid)
    expect(resp).to.be.ok()
    const text = await resp.text() // this currently has UnixFS data in it, and should not when returned from verified-fetch

    // the below commented lines will get the test to pass, but we need to move this into verified fetch
    // const marshalledResponseData = await resp.arrayBuffer()
    // const encodedText = UnixFS.unmarshal(new Uint8Array(marshalledResponseData)).data
    // const text = textDecoder.decode(encodedText)

    expect(text).to.equal(givenString)
  })
})
