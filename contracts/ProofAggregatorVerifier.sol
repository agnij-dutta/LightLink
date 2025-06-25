// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 12505958266378938912160217880536361281389623174615669366054833742104351134006;
    uint256 constant deltax2 = 9994714196297513498418043263371301003769769164562746376416321184690738899315;
    uint256 constant deltay1 = 640032346200592082704136230079027618102922598789576221862267771423010489717;
    uint256 constant deltay2 = 10918603877909191207106306851249585526950608130741624390175676321304004274555;

    
    uint256 constant IC0x = 8240428306876470164134135617562246284779944529640642968573711968935029793986;
    uint256 constant IC0y = 6276743396310557967149414573887347855566747633058847581134238635553546728973;
    
    uint256 constant IC1x = 13073108316448216518077131502782718715626546720529209414579602055149514848288;
    uint256 constant IC1y = 322152473885994496997025402698571773314511970240548920821233042919241940983;
    
    uint256 constant IC2x = 2791300095381991120124167397446720218858137073337322427236329721292692270814;
    uint256 constant IC2y = 4544794003945529781143391969374366425347081266158527517840147539484419820995;
    
    uint256 constant IC3x = 19645469017495592695540350967955859546484621319256374484056727136599547606638;
    uint256 constant IC3y = 18697930917544034351298327469087915570033368374434001321587528944290801109203;
    
    uint256 constant IC4x = 16910166683887318333481434805674246875139464559580633715083987147020721708835;
    uint256 constant IC4y = 792703764463572463139192132649105363575378897947290949035812076745990120867;
    
    uint256 constant IC5x = 15560237400685873398362820384549932152757632130648282778334464171891511666433;
    uint256 constant IC5y = 3812228525407812408679125756063206511605412086925363235460836690059372235733;
    
    uint256 constant IC6x = 10860416657929883151054035322834547604093693909161011644258387912233047033375;
    uint256 constant IC6y = 18619626621865178485618622842554550087441523435860342475088915761964686539011;
    
    uint256 constant IC7x = 3415692894362286796611725849580135933147621115890634693555867569173370018756;
    uint256 constant IC7y = 21377706379272013785586224871973245587007687503994144242337381297748703617308;
    
    uint256 constant IC8x = 4213173132141625542992610312456463685098583445135796273757616052321183532438;
    uint256 constant IC8y = 10994196622462305279704381582477642051909722579670310300011847842062110048353;
    
    uint256 constant IC9x = 10307134289418399945671602552754551553599866477002377124536707814462347439457;
    uint256 constant IC9y = 21542199146798645114614525390469772252920409035579422807456023428118099316093;
    
    uint256 constant IC10x = 2417119899053063706875751498542164776426627232306745848704859226467501773808;
    uint256 constant IC10y = 9839214498543608310487097872381527687138270182402123965401678029813919415915;
    
    uint256 constant IC11x = 235729748876977526484762297992466418180359957424650742137301543857520154667;
    uint256 constant IC11y = 2645435773406259450718171699772488786757925115186638161998315211177936283310;
    
    uint256 constant IC12x = 3228135099789713476567301952344839008582164368408418369979463982631609684804;
    uint256 constant IC12y = 14004296616819036167473243311887159850589533160068380405951703285164572806514;
    
    uint256 constant IC13x = 12890636630649915437511982615912027613691271850103214147227524098374241478244;
    uint256 constant IC13y = 20193792980876277730713435569953611630528011483084598397509703991808514081911;
    
    uint256 constant IC14x = 4830197466180689087963511081159318995872257592295116651119979257816478673844;
    uint256 constant IC14y = 5048205376960459627020276648604922496558957752907505901454340133730206470926;
    
    uint256 constant IC15x = 19121849053534398426878095700058538599915989293678631013171692617469147103995;
    uint256 constant IC15y = 10189336901192476820781855416146768093208562949011679375593175601399933672628;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[15] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
