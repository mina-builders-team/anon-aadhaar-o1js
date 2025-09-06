import { Presentation } from "mina-attestations";
import { ageMoreThan18Spec } from "./presentationSpecs.js";
import { Field, method,Permissions, SmartContract, State, state } from "o1js";
export { zkappFactory }

async function zkappFactory(){
    const spec = await ageMoreThan18Spec();

    let precompiled = await Presentation.precompile(spec);

    class ProvablePresentation extends precompiled.ProvablePresentation{};

    class CounterZkapp extends SmartContract{
        @state(Field) public counter = State<Field>();

        
        async deploy(){
            super.deploy();
            this.account.permissions.set({
                ...Permissions.default(),
                send: Permissions.none(),
            });
        }
        
        @method async initialize(){
            
            const isInitialized = this.account.provedState.getAndRequireEquals();
            isInitialized.assertFalse('This ZkApp is already initialized.');

            super.init();

            this.counter.set(Field.from(0));
        }

        @method async verifyAadhaar(presentation: ProvablePresentation){
            let {claims, outputClaim} = presentation.verify({
                publicKey: this.address,
                tokenId: this.tokenId,
                methodName: 'verifyAadhaar',
            });   

            const counterValue = this.counter.getAndRequireEquals();
            
            counterValue.add(Field.from(1));
            
            this.counter.set(counterValue);
        }
    };
    return {CounterZkapp, ProvablePresentation};
}


