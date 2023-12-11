// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.20;

interface IValidator {
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

    function itemOf(uint256 _idx) external view returns (address);
    function itemsLength() external view returns (uint256);
    function isActiveValidator(address _account) external view returns (bool);
    function activeItemsLength() external view returns (uint256);
    function validatorOf(address _account) external view returns (ValidatorData memory);
}
