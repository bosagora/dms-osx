// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @notice 검증자들을 저장하는 컨트랙트
contract ValidatorCollection {
    /// @notice 검증자의 상태코드
    enum Status {
        INVALID, //  초기값
        ACTIVE, //  검증자의 기능이 활성화됨
        STOP, //  예치금 부족으로 정지된 상태
        EXIT //  탈퇴한 상태
    }

    struct ValidatorData {
        address validator; // 검증자의 지갑주소
        uint256 start; // 검증자로서 역할을 수행할 수 있는 시작 시간
        uint256 balance; // 검증자의 예치금
        Status status; // 검증자의 상태
    }

    /// @notice 검증자 데이타가 저장되는 배열
    ValidatorData[] public items;

    /// @notice 검증자가 추가될 때 발생되는 이벤트
    event Added(address validator, uint256 start, uint256 balance, Status status);

    /// @notice 생성자
    /// @param validators 초기에 설정될 검증자이다. 예치금이 예치된 후 그 즉시 활성화 된다.
    constructor(address[] memory validators) {
        for (uint256 i = 0; i < validators.length; ++i) {
            ValidatorData memory item = ValidatorData({
                validator: validators[i],
                start: block.timestamp,
                balance: 0,
                status: Status.STOP
            });
            items.push(item);

            emit Added(item.validator, item.start, item.balance, item.status);
        }
    }
}
