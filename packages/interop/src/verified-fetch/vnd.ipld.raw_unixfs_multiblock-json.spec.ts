import { createVerifiedFetch } from '@helia/verified-fetch'
import { expect } from 'aegir/chai'
import drain from 'it-drain'
import { CID } from 'multiformats/cid'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Controller } from 'ipfsd-ctl'

describe.skip('vnd.ipld.raw - unixfs - multiblock-json', () => {
  let controller: Controller<'go'>
  let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>

  before(async () => {
    controller = await createKuboNode()
    await controller.start()
    verifiedFetch = await createVerifiedFetch({
      gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`],
      routers: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`]
    })
  })

  after(async () => {
    await controller.stop()
    await verifiedFetch.stop()
  })

  // As of 2024-01-18, https://cloudflare-ipfs.com/ipns/tokens.uniswap.org resolves to:
  // root: QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr
  // child1: QmNik5N4ryNwzzXYq5hCYKGcRjAf9QtigxtiJh9o8aXXbG // partial JSON
  // child2: QmWNBJX6fZyNTLWNYBHxAHpBctCP43R2zeqV2G8uavqFZn // partial JSON
  it('handles uniswap tokens list json', async () => {
    // add the root node to the kubo node
    await drain(controller.api.refs('/ipfs/QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr', {
      recursive: true
    }))

    const resp = await verifiedFetch(CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr'))
    expect(resp).to.be.ok()
    const jsonObj = await resp.json()
    expect(jsonObj).to.be.ok()
    expect(jsonObj).to.have.property('name').equal('Uniswap Labs Default')
    expect(jsonObj).to.have.property('timestamp').equal('2023-12-13T18:25:25.830Z')
    expect(jsonObj).to.have.property('version').to.deep.equal({ major: 11, minor: 11, patch: 0 })
    expect(jsonObj).to.have.property('tags')
    expect(jsonObj).to.have.property('logoURI').equal('ipfs://QmNa8mQkrNKp1WEEeGjFezDmDeodkWRevGFN8JCV7b4Xir')
    expect(jsonObj).to.have.property('keywords').to.deep.equal(['uniswap', 'default'])
    expect(jsonObj.tokens).to.be.an('array').of.length(767)
  })
})
