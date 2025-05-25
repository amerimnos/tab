/**
 * 표준 탭과 패널 내부에 고정되는 스티키 탭을 모두 처리합니다.
 * URL 업데이트, 기본 탭 활성화, 키보드 탐색 및 접근성 기능, 특정 URL 이동을 지원합니다.
 */
class TabSystem {
    /**
     * TabSystem 인스턴스를 생성합니다.
     * @param {object} [options={}] - 탭 시스템을 위한 설정 옵션 객체입니다.
     * @param {string} [options.standardTabsSelector=".standard-tabs"] - 표준 탭 컨테이너의 CSS 선택자입니다.
     * @param {string} [options.standardPanelsContainerSelector=".standard-tabpanels"] - 표준 탭 패널 컨테이너의 CSS 선택자입니다.
     * @param {string} [options.stickyTabsNavSelector=".sticky-tabs"] - 스티키 탭 네비게이션의 CSS 선택자입니다.
     * @param {string} [options.activeClass="active"] - 활성 상태를 나타내는 일반 CSS 클래스명입니다.
     * @param {string} [options.standardTabActiveClass="standard-tabs__button--active"] - 활성 표준 탭 버튼에 적용될 CSS 클래스명입니다.
     * @param {string} [options.standardPanelActiveClass="standard-tabpanels__panel--active"] - 활성 표준 탭 패널에 적용될 CSS 클래스명입니다.
     * @param {string} [options.stickyLinkActiveClass="active"] - 활성 스티키 탭 링크에 적용될 CSS 클래스명입니다.
     * @param {?string} [options.defaultStandardTabId=null] - 기본으로 활성화할 표준 탭의 ID입니다.
     * @param {number} [options.stickyOffset=0] - 스티키 탭 스크롤 위치 계산 시 추가할 오프셋 값입니다.
     * @param {string} [options.scrollBehavior="smooth"] - 스크롤 이동 시의 동작 방식입니다.
     * @param {boolean} [options.updateURL=true] - 탭 변경 시 URL을 업데이트할지 여부입니다.
     * @param {boolean} [options.focusPanelOnActivate=true] - 표준 탭 패널 활성화 시 패널에 포커스를 줄지 여부입니다.
     * @param {boolean} [options.focusSectionOnScroll=true] - 스티키 탭 섹션으로 스크롤 시 섹션에 포커스를 줄지 여부입니다.
     */
    constructor(options = {}) {
        this.options = Object.assign(
            {
                standardTabsSelector: ".standard-tabs",
                standardPanelsContainerSelector: ".standard-tabpanels",
                stickyTabsNavSelector: ".sticky-tabs",
                activeClass: "active",
                standardTabActiveClass: "standard-tabs__button--active",
                standardPanelActiveClass: "standard-tabpanels__panel--active",
                stickyLinkActiveClass: "active",
                defaultStandardTabId: null,
                stickyOffset: 0,
                scrollBehavior: "smooth",
                updateURL: true,
                focusPanelOnActivate: true,
                focusSectionOnScroll: true,
                observerDisableDelay: 500, // 사용자가 클릭 후 Observer를 비활성화할 시간 (ms) - 부드러운 스크롤 시
                instantScrollOnUserClick: true, // 사용자 클릭 시 스티키 네비게이션을 즉시 스크롤할지 여부
            },
            options
        );

        this.elStandardTabContainers = document.querySelectorAll(this.options.standardTabsSelector);
        this.elStandardPanelsContainer = document.querySelector(this.options.standardPanelsContainerSelector);
        this.userInitiatedStickyAction = false; // 사용자가 스티키 탭 관련 액션을 시작했는지 여부
        this.observerDisableTimeoutId = null;   // Observer 비활성화 타임아웃 ID
        this.stickyNavScrollTimeoutId = null;   // 스티키 네비게이션 스크롤 타임아웃 ID

        if (!this.elStandardPanelsContainer) {
            console.error("표준 패널 컨테이너를 찾을 수 없습니다:", this.options.standardPanelsContainerSelector);
            return;
        }

        this.isMobile = window.matchMedia("(max-width: 767px)").matches;
        this.headerHeight = this._getHeaderHeight();
        this.observerInstances = new Map();
        this.urlUpdateDisabled = false; // URL 업데이트가 보안상 금지되었는지 여부
        this.currentActiveStandardTabId = null;

        this.initialUrlWasEmpty = window.location.search === "";
        // URL에 파라미터가 없었다면, 초기 자동 활성화 시퀀스가 완료되지 않은 것으로 시작
        this.initialActivationSequenceCompleted = !this.initialUrlWasEmpty;

        this._init();
    }

    /**
     * 페이지 헤더의 높이를 가져옵니다.
     * @private
     * @returns {number} 헤더의 높이 (px). 헤더가 없으면 0을 반환합니다.
     */
    _getHeaderHeight() {
        const elHeader = document.querySelector("header");
        return elHeader ? elHeader.offsetHeight : 0;
    }

    /**
     * 탭 시스템을 초기화합니다.
     * @private
     */
    _init() {
        this.elStandardTabContainers.forEach((elContainer) => {
            this._initializeStandardTabsListeners(elContainer);
        });

        this._activateInitialStandardTab();
        window.addEventListener("resize", this._handleResize.bind(this));
    }

    /**
     * 초기 로드 시 적절한 표준 탭을 활성화합니다.
     * URL 파라미터, 기본 설정, 또는 첫 번째 탭 순으로 활성화를 시도합니다.
     * @private
     */
    _activateInitialStandardTab() {
        let tabActivated = false;
        // 1. URL에 standardTab 파라미터가 있고, URL 업데이트가 활성화되어 있으며, URL이 초기에 비어있지 않았던 경우
        if (this.options.updateURL && !this.initialUrlWasEmpty) {
            const standardTabIdFromURL = this._getURLParam("standardTab");
            if (standardTabIdFromURL) {
                const elStandardTabToActivate = document.getElementById(standardTabIdFromURL);
                if (elStandardTabToActivate) {
                    elStandardTabToActivate.click();
                    tabActivated = true;
                } else {
                    console.warn(`URL의 표준 탭 ID "${standardTabIdFromURL}"를 찾을 수 없습니다.`);
                }
            }
        }

        // 2. URL 파라미터로 활성화되지 않았거나, 조건에 맞지 않는 경우 (기본 탭 또는 첫 탭 활성화)
        if (!tabActivated) {
            let elTabToActivate = this.options.defaultStandardTabId
                ? document.getElementById(this.options.defaultStandardTabId)
                : null;

            if (!elTabToActivate) {
                elTabToActivate = document.querySelector(`${this.options.standardTabsSelector} [role="tab"]`);
            }

            if (elTabToActivate) {
                // 초기 URL이 비어 있었고 URL 업데이트가 활성화된 경우, 첫 자동 활성화는 URL을 변경하지 않도록 처리
                if (this.initialUrlWasEmpty && this.options.updateURL) {
                    const originalUpdateSetting = this.options.updateURL;
                    this.options.updateURL = false; // 임시로 URL 업데이트 비활성화
                    elTabToActivate.click();
                    this.options.updateURL = originalUpdateSetting; // 원래 설정 복원
                    this.initialActivationSequenceCompleted = true; // 초기 자동 활성화 시퀀스 완료
                } else {
                    elTabToActivate.click();
                    // URL이 비어 있었지만 updateURL 옵션이 false였거나, URL이 비어있지 않았다면 이미 completed 상태
                    if (this.initialUrlWasEmpty) {
                        this.initialActivationSequenceCompleted = true;
                    }
                }
            }
        }
    }


    /**
     * 지정된 컨테이너 내의 표준 탭들에 대한 이벤트 리스너를 초기화합니다.
     * @private
     * @param {HTMLElement} elTabContainer - 표준 탭들을 포함하는 컨테이너 엘리먼트입니다.
     */
    _initializeStandardTabsListeners(elTabContainer) {
        const elTabs = elTabContainer.querySelectorAll('[role="tab"]');
        elTabs.forEach((elTab) => {
            elTab.addEventListener("click", (event) =>
                this._handleStandardTabClick(event, elTab, elTabs)
            );
            elTab.addEventListener("keydown", (event) =>
                this._handleTabKeydown(event, elTab, elTabs)
            );
        });
    }

    /**
     * 표준 탭 클릭 이벤트를 처리합니다.
     * @private
     * @param {Event} event - 클릭 이벤트 객체입니다.
     * @param {HTMLElement} elClickedTab - 클릭된 탭 엘리먼트입니다.
     * @param {NodeListOf<HTMLElement>} allTabsInGroup - 현재 그룹 내 모든 탭 엘리먼트의 목록입니다.
     */
    _handleStandardTabClick(event, elClickedTab, allTabsInGroup) {
        event.preventDefault();
        const targetPanelId = elClickedTab.getAttribute("aria-controls");
        const elTargetPanel = document.getElementById(targetPanelId);

        if (!elTargetPanel) {
            console.error("탭에 대한 대상 표준 패널을 찾을 수 없습니다:", elClickedTab.id);
            return;
        }

        // 사용자의 실제 클릭에 의해서만 초기 활성화 시퀀스를 완료로 표시
        if (event.isTrusted) {
            this.initialActivationSequenceCompleted = true;
            this._updateURL("stickyTab", null); // 표준 탭 변경 시 스티키 탭 URL 파라미터 제거
        }

        this._deactivateStandardTabGroup(allTabsInGroup);
        this._activateStandardTab(elClickedTab, elTargetPanel);

        this.currentActiveStandardTabId = elClickedTab.id;

        // 표준 탭 URL 업데이트 (옵션 활성화 및 URL 업데이트 가능 상태, 그리고 사용자 클릭 또는 초기 시퀀스 완료 시)
        if (this.options.updateURL && !this.urlUpdateDisabled && (event.isTrusted || this.initialActivationSequenceCompleted)) {
            this._updateURL("standardTab", elClickedTab.id);
        }

        this._initializeStickyTabsInPanel(elTargetPanel);
        this._activateStickyTabFromURLOrObserver(elTargetPanel);
    }

    /**
     * 표준 탭 그룹 내 모든 탭과 패널을 비활성화하고 관련 IntersectionObserver를 정리합니다.
     * @private
     * @param {NodeListOf<HTMLElement>} allTabsInGroup - 비활성화할 탭 그룹입니다.
     */
    _deactivateStandardTabGroup(allTabsInGroup) {
        allTabsInGroup.forEach((elTabToDeactivate) => {
            elTabToDeactivate.setAttribute("aria-selected", "false");
            elTabToDeactivate.classList.remove(
                this.options.standardTabActiveClass,
                this.options.activeClass
            );
            const elPanelToDeactivate = document.getElementById(elTabToDeactivate.getAttribute("aria-controls"));
            if (elPanelToDeactivate) {
                elPanelToDeactivate.classList.remove(
                    this.options.standardPanelActiveClass,
                    this.options.activeClass
                );
                elPanelToDeactivate.hidden = true;
                if (this.observerInstances.has(elPanelToDeactivate.id)) {
                    this.observerInstances.get(elPanelToDeactivate.id).disconnect();
                    this.observerInstances.delete(elPanelToDeactivate.id);
                }
            }
        });
    }

    /**
     * 특정 표준 탭과 관련 패널을 활성화하고 필요한 경우 포커스를 설정합니다.
     * @private
     * @param {HTMLElement} elClickedTab - 활성화할 탭 엘리먼트입니다.
     * @param {HTMLElement} elTargetPanel - 활성화할 패널 엘리먼트입니다.
     */
    _activateStandardTab(elClickedTab, elTargetPanel) {
        elClickedTab.setAttribute("aria-selected", "true");
        elClickedTab.classList.add(this.options.standardTabActiveClass, this.options.activeClass);

        elTargetPanel.classList.add(this.options.standardPanelActiveClass, this.options.activeClass);
        elTargetPanel.hidden = false;

        if (this.options.focusPanelOnActivate) {
            const focusableElement = elTargetPanel.querySelector("h3") || elTargetPanel.querySelector("h2") || elTargetPanel;
            this._focusElement(focusableElement);
        }
    }

    /**
     * 새로 활성화된 표준 패널 내부의 스티키 탭을 URL 파라미터나 기본 상태에 따라 활성화합니다.
     * @private
     * @param {HTMLElement} elStandardPanel - 현재 활성화된 표준 패널입니다.
     */
    _activateStickyTabFromURLOrObserver(elStandardPanel) {
        let stickyTabToActivateId = null;
        // URL 업데이트가 활성화되어 있고, URL에서 스티키 탭 ID를 가져올 수 있으며,
        // 초기 자동 활성화 시퀀스가 이미 완료되었거나 사용자의 직접적인 표준 탭 클릭으로 인한 경우에만 URL의 스티키 탭을 사용합니다.
        if (this.options.updateURL && !this.urlUpdateDisabled && this.initialActivationSequenceCompleted) {
            stickyTabToActivateId = this._getURLParam("stickyTab");
        }

        const elStickyTabsNav = elStandardPanel.querySelector(this.options.stickyTabsNavSelector);
        if (!elStickyTabsNav) return;

        if (stickyTabToActivateId) {
            const elStickyLinkToActivate = elStickyTabsNav.querySelector(`#${stickyTabToActivateId}`);
            if (elStickyLinkToActivate) {
                this._handleStickyTabClick(
                    new Event("click"), // 프로그래매틱 클릭 이벤트 생성
                    elStickyLinkToActivate,
                    elStickyTabsNav,
                    elStandardPanel.id,
                    true // isAutoActivation = true (URL 또는 자동 활성화로 간주)
                );

                const targetSectionId = elStickyLinkToActivate.getAttribute("href")?.substring(1);
                const elTargetSection = targetSectionId ? document.getElementById(targetSectionId) : null;
                if (elTargetSection) {
                    requestAnimationFrame(() => { // 레이아웃 계산 후 스크롤
                        const stickyTabsNavHeight = elStickyTabsNav.offsetHeight;
                        const scrollToPosition = elTargetSection.offsetTop - this.headerHeight - stickyTabsNavHeight - this.options.stickyOffset;
                        window.scrollTo({ top: scrollToPosition, behavior: "instant" });
                    });
                }
                return; // URL에서 스티키 탭을 활성화했으므로 종료
            }
        }
        // URL에 특정 스티키 탭이 없거나 조건을 만족하지 않으면 IntersectionObserver가 첫 번째 보이는 탭을 활성화할 수 있습니다.
        // _initializeStickyScrollBehavior에서 observer가 처리합니다.
    }


    /**
     * 지정된 표준 패널 내의 스티키 탭들을 초기화합니다.
     * @private
     * @param {HTMLElement} elStandardPanel - 스티키 탭을 포함하는 표준 패널 엘리먼트입니다.
     */
    _initializeStickyTabsInPanel(elStandardPanel) {
        const elStickyTabsNav = elStandardPanel.querySelector(this.options.stickyTabsNavSelector);
        if (!elStickyTabsNav) return;

        if (this.observerInstances.has(elStandardPanel.id)) {
            this.observerInstances.get(elStandardPanel.id).disconnect();
            this.observerInstances.delete(elStandardPanel.id);
        }

        const stickyTabLinks = elStickyTabsNav.querySelectorAll('.sticky-tabs__link[role="tab"]');
        stickyTabLinks.forEach((elLink) => {
            // 기존 핸들러 제거 (중복 방지)
            if (elLink._stickyClickHandler) elLink.removeEventListener("click", elLink._stickyClickHandler);
            if (elLink._stickyKeydownHandler) elLink.removeEventListener("keydown", elLink._stickyKeydownHandler);

            elLink._stickyClickHandler = (event) => this._handleStickyTabClick(event, elLink, elStickyTabsNav, elStandardPanel.id);
            elLink.addEventListener("click", elLink._stickyClickHandler);

            elLink._stickyKeydownHandler = (event) => this._handleTabKeydown(event, elLink, stickyTabLinks);
            elLink.addEventListener("keydown", elLink._stickyKeydownHandler);
        });

        this._initializeStickyScrollBehavior(elStickyTabsNav, elStandardPanel.id, stickyTabLinks);
    }

    /**
     * 스티키 탭 링크 클릭 이벤트를 처리합니다.
     * @private
     * @param {Event} event - 클릭 또는 스크롤 이벤트 객체입니다.
     * @param {HTMLElement} elClickedStickyLink - 클릭된 스티키 탭 링크 엘리먼트입니다.
     * @param {HTMLElement} elStickyTabsNav - 스티키 탭 네비게이션 엘리먼트입니다.
     * @param {string} standardPanelId - 부모 표준 패널의 ID입니다. (IntersectionObserver 컨텍스트에서 사용될 수 있음)
     * @param {boolean} [isAutoActivation=false] - 스크롤 또는 URL 로드에 의해 자동으로 트리거되었는지 여부입니다.
     */
    _handleStickyTabClick(event, elClickedStickyLink, elStickyTabsNav, standardPanelId, isAutoActivation = false) {
        event.preventDefault();
        const targetSectionId = elClickedStickyLink.getAttribute("href")?.substring(1);
        const elTargetSection = targetSectionId ? document.getElementById(targetSectionId) : null;

        if (!elTargetSection) {
            console.error("스티키 탭에 대한 대상 섹션을 찾을 수 없습니다:", elClickedStickyLink.id);
            return;
        }

        const isUserClick = !isAutoActivation && event.isTrusted;
            if (isUserClick) {
            this.initialActivationSequenceCompleted = true;
            this.userInitiatedStickyAction = true; // 사용자가 액션 시작

            // Observer를 잠시 비활성화 (페이지 스크롤 중 Observer 간섭 방지)
            if (this.observerDisableTimeoutId) clearTimeout(this.observerDisableTimeoutId);
            this.observerDisableTimeoutId = setTimeout(() => {
                this.userInitiatedStickyAction = false; // 액션 완료 후 Observer 다시 활성화 준비
            }, this.options.scrollBehavior === 'smooth' ? this.options.observerDisableDelay : 50);
        }

        // 현재 진행 중인 스티키 네비게이션의 부드러운 스크롤 중단 (해당하는 경우)
        if (this.stickyNavScrollTimeoutId) {
             clearTimeout(this.stickyNavScrollTimeoutId);
             this.stickyNavScrollTimeoutId = null;
        }

        this._deactivateAllStickyTabs(elStickyTabsNav);
        this._activateStickyTab(elClickedStickyLink);

        if (this.options.updateURL && !this.urlUpdateDisabled && isUserClick) {
            this._updateURL("stickyTab", elClickedStickyLink.id);
            if (this.currentActiveStandardTabId) {
                this._updateURL("standardTab", this.currentActiveStandardTabId);
            }
        }

       // 스크롤 및 포커스
        this._scrollToSectionAndFocus(
            elTargetSection,
            elStickyTabsNav,
            isAutoActivation, // isAutoActivation 전달
            isUserClick // isClickEvent 대신 isUserClick으로 명확히
        );

        // 스티키 네비게이션 가로 스크롤
        const stickyNavScrollBehavior = (isUserClick && this.options.instantScrollOnUserClick) ? "instant" : "smooth";
        this._scrollStickyNavToCenter(elStickyTabsNav, elClickedStickyLink, stickyNavScrollBehavior);
    }

    /**
     * 모든 스티키 탭 링크를 비활성화합니다.
     * @private
     * @param {HTMLElement} elStickyTabsNav - 스티키 탭 네비게이션 엘리먼트입니다.
     */
    _deactivateAllStickyTabs(elStickyTabsNav) {
        elStickyTabsNav.querySelectorAll('.sticky-tabs__link[role="tab"]').forEach((elLink) => {
            elLink.classList.remove(this.options.stickyLinkActiveClass, this.options.activeClass);
            elLink.setAttribute("aria-selected", "false");
            const elBlindText = elLink.querySelector(".blind");
            if (elBlindText) elBlindText.remove();
        });
    }

    /**
     * 특정 스티키 탭 링크를 활성화하고 "선택됨" 텍스트를 추가합니다.
     * @private
     * @param {HTMLElement} elStickyLink - 활성화할 스티키 탭 링크입니다.
     */
    _activateStickyTab(elStickyLink) {
        elStickyLink.classList.add(this.options.stickyLinkActiveClass, this.options.activeClass);
        elStickyLink.setAttribute("aria-selected", "true");
        if (!elStickyLink.querySelector(".blind")) {
            const em = document.createElement("em");
            em.className = "blind";
            em.textContent = "선택됨";
            elStickyLink.appendChild(em);
        }
    }

    /**
     * 대상 섹션으로 스크롤하고 필요한 경우 포커스를 설정합니다.
     * @private
     * @param {HTMLElement} elTargetSection - 스크롤 및 포커스 대상 섹션입니다.
     * @param {HTMLElement} elStickyTabsNav - 스티키 탭 네비게이션 엘리먼트입니다.
     * @param {boolean} isAutoActivation - 자동 활성화 여부입니다.
     * @param {boolean} isClickEvent - 이벤트 타입이 클릭인지 여부입니다.
     */
    _scrollToSectionAndFocus(elTargetSection, elStickyTabsNav, isAutoActivation, isClickEvent) {
        const stickyTabsNavHeight = elStickyTabsNav.offsetHeight;
        const scrollToPosition = elTargetSection.offsetTop - this.headerHeight - stickyTabsNavHeight - this.options.stickyOffset;

        // 자동 활성화가 아니거나, 자동 활성화라도 명시적인 클릭 이벤트로 트리거된 경우 스크롤 동작 실행
        if (!isAutoActivation || isClickEvent) {
            window.scrollTo({
                top: scrollToPosition,
                behavior: (isAutoActivation && !isClickEvent) ? "instant" : this.options.scrollBehavior,
            });
        }

        // 자동 활성화가 아니고, 스크롤 시 섹션 포커스 옵션이 켜져 있을 때 포커스
        if (this.options.focusSectionOnScroll && !isAutoActivation) {
            this._focusElement(elTargetSection);
        }
    }


    /**
     * 스티키 탭의 스크롤 동작을 IntersectionObserver를 사용하여 초기화합니다.
     * @private
     * @param {HTMLElement} elStickyTabsNav - 스티키 탭 네비게이션 엘리먼트입니다.
     * @param {string} standardPanelId - 현재 표준 패널의 ID입니다.
     * @param {NodeListOf<HTMLElement>} stickyTabLinks - 스티키 탭 링크 엘리먼트 목록입니다.
     */
    _initializeStickyScrollBehavior(elStickyTabsNav, standardPanelId, stickyTabLinks) {
        const sections = Array.from(stickyTabLinks)
            .map(elLink => {
                const href = elLink.getAttribute("href");
                return href ? document.getElementById(href.substring(1)) : null;
            })
            .filter(Boolean);

        if (!sections.length) return;

        const stickyNavHeight = elStickyTabsNav.offsetHeight;
        const rootMarginTop = -(this.headerHeight + stickyNavHeight + this.options.stickyOffset + 1);
        const rootMarginBottom = -(window.innerHeight - (this.headerHeight + stickyNavHeight + this.options.stickyOffset) - 50);

        const observerOptions = {
            root: null,
            rootMargin: `${rootMarginTop}px 0px ${rootMarginBottom}px 0px`,
            threshold: 0.01, // 섹션이 조금이라도 보이면 트리거
        };

        let lastActivatedByScroll = null; // 중복 활성화 방지

        const observerCallback = (entries) => {
            if (this.userInitiatedStickyAction) {
                return;
            }

            entries.forEach((entry) => {
                const sectionId = entry.target.id;
                const elCorrespondingTabLink = elStickyTabsNav.querySelector(`.sticky-tabs__link[href="#${sectionId}"]`);

                if (entry.isIntersecting && elCorrespondingTabLink && lastActivatedByScroll !== elCorrespondingTabLink) {
                    // 스크롤로 인한 자동 활성화이므로 isAutoActivation = true
                    this._handleStickyTabClick(new Event("scroll"), elCorrespondingTabLink, elStickyTabsNav, standardPanelId, true);
                    lastActivatedByScroll = elCorrespondingTabLink;

                    // 스크롤에 의한 URL 업데이트 (옵션 활성화 및 URL 업데이트 가능 상태, 초기 시퀀스 완료 시)
                    if (this.options.updateURL && !this.urlUpdateDisabled && this.initialActivationSequenceCompleted) {
                        this._updateURL("stickyTab", elCorrespondingTabLink.id, true);
                        if (this.currentActiveStandardTabId) {
                            this._updateURL("standardTab", this.currentActiveStandardTabId, true);
                        }
                    }
                }
            });
            // 뷰포트에 활성 섹션이 전혀 없는 경우 처리 (예: 모든 스티키 탭 비활성화) - 현재는 특별한 동작 없음
            // const activeEntries = entries.filter(e => e.isIntersecting);
            // if (activeEntries.length === 0 && lastActivatedByScroll) { /* 모든 탭 비활성화 로직? */ }
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        sections.forEach((elSection) => observer.observe(elSection));
        this.observerInstances.set(standardPanelId, observer);
    }

    /**
     * 브라우저 URL의 쿼리 파라미터를 업데이트합니다.
     * @private
     * @param {string} paramName - 업데이트할 파라미터의 이름입니다.
     * @param {?string} value - 파라미터의 새 값입니다. null이면 파라미터를 제거합니다.
     * @param {boolean} [isScrollUpdate=false] - 스크롤에 의한 업데이트인지 여부 (URL 업데이트 결정 로직에는 직접 사용 안됨).
     */
    _updateURL(paramName, value, isScrollUpdate = false) { // isScrollUpdate는 로깅이나 추후 확장용으로 남겨둘 수 있음
        if (!this.options.updateURL || this.urlUpdateDisabled) return;

        try {
            const url = new URL(window.location.href);
            if (value) {
                url.searchParams.set(paramName, value);
            } else {
                url.searchParams.delete(paramName);
            }
            // blob: URL 등에서 searchParams 사용 시 에러 발생 가능하므로 현재 URL과 다를 때만 pushState/replaceState
            if (window.location.href !== url.href) {
                 history.replaceState(null, "", url.toString());
            }
        } catch (error) {
            if (error.name === "SecurityError" || error.message.includes("URL.searchParams")) { // blob URL 등
                if (!this.urlUpdateDisabled) { // 경고는 한 번만
                    console.warn("URL 업데이트가 보안 제약으로 인해 비활성화되었습니다 (예: 로컬 파일, blob: URL).", error);
                    this.urlUpdateDisabled = true; // 더 이상 URL 업데이트 시도 안 함
                }
            } else {
                console.error("URL 업데이트 중 오류 발생:", error);
            }
        }
    }

    /**
     * 스티키 네비게이션 바를 스크롤하여 활성 링크를 중앙에 표시합니다.
     * @private
     * @param {HTMLElement} elNav - 스티키 네비게이션 바 엘리먼트입니다.
     * @param {HTMLElement} elActiveLink - 현재 활성화된 링크 엘리먼트입니다.
     */
    _scrollStickyNavToCenter(elNav, elActiveLink, behavior = "smooth") {
        if (!elNav || !elActiveLink || typeof elNav.getBoundingClientRect !== "function") return;

        const navRect = elNav.getBoundingClientRect();
        const linkRect = elActiveLink.getBoundingClientRect();
        const scrollAmount = elNav.scrollLeft + (linkRect.left - navRect.left) - (navRect.width / 2) + (linkRect.width / 2);

        if (this.stickyNavScrollTimeoutId) {
            clearTimeout(this.stickyNavScrollTimeoutId);
            this.stickyNavScrollTimeoutId = null;
        }

        elNav.scrollTo({ left: scrollAmount, behavior: "smooth" });

        if (behavior === 'smooth') {
            // 부드러운 스크롤이 완료될 것으로 예상되는 시간 이후에 관련 상태 초기화
            // 정확한 완료 시점 감지는 어려우므로 추정치 사용
            this.stickyNavScrollTimeoutId = setTimeout(() => {
                this.stickyNavScrollTimeoutId = null;
            }, 500); // CSS transition 또는 애니메이션 시간보다 약간 길게 설정
        }
    }

    /**
     * 탭의 키보드 다운 이벤트를 처리합니다.
     * @private
     * @param {KeyboardEvent} event - 키보드 이벤트 객체입니다.
     * @param {HTMLElement} elCurrentTab - 현재 포커스된 탭 엘리먼트입니다.
     * @param {NodeListOf<HTMLElement>} allTabsInGroup - 현재 그룹 내 모든 탭 엘리먼트 목록입니다.
     */
    _handleTabKeydown(event, elCurrentTab, allTabsInGroup) {
        const { key } = event;
        let currentIndex = Array.from(allTabsInGroup).indexOf(elCurrentTab);
        let newIndex = currentIndex;
        let preventDefault = true;

        const KEY_ACTIONS = {
            ArrowLeft: () => newIndex = currentIndex > 0 ? currentIndex - 1 : allTabsInGroup.length - 1,
            ArrowUp: () => newIndex = currentIndex > 0 ? currentIndex - 1 : allTabsInGroup.length - 1,
            ArrowRight: () => newIndex = currentIndex < allTabsInGroup.length - 1 ? currentIndex + 1 : 0,
            ArrowDown: () => newIndex = currentIndex < allTabsInGroup.length - 1 ? currentIndex + 1 : 0,
            Home: () => newIndex = 0,
            End: () => newIndex = allTabsInGroup.length - 1,
            Enter: () => {
                allTabsInGroup[newIndex].click(); // 사용자의 명시적 액션
                this.initialActivationSequenceCompleted = true;
            },
            " ": () => { // Space key
                allTabsInGroup[newIndex].click();
                this.initialActivationSequenceCompleted = true;
            }
        };

        if (KEY_ACTIONS[key]) {
            KEY_ACTIONS[key]();
        } else {
            preventDefault = false;
        }

        if (preventDefault) {
            event.preventDefault();
        }

        if (newIndex !== currentIndex && allTabsInGroup[newIndex]) {
            allTabsInGroup[newIndex].focus();
        }
    }

    /**
     * URL에서 지정된 쿼리 파라미터 값을 가져옵니다.
     * @private
     * @param {string} paramName - 가져올 파라미터의 이름입니다.
     * @returns {?string} 파라미터 값 또는 찾을 수 없는 경우 null을 반환합니다.
     */
    _getURLParam(paramName) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(paramName);
        } catch (error) {
            if (error.name === "SecurityError" || error.message.includes("URL.searchParams")) {
                if (!this.urlUpdateDisabled) {
                     console.warn("보안 제약으로 인해 URL 파라미터를 읽을 수 없습니다. URL 기반 탭 활성화에 영향을 줄 수 있습니다.");
                }
                this.urlUpdateDisabled = true;
            } else {
                console.error("URL 파라미터 가져오기 중 오류 발생:", error);
            }
            return null;
        }
    }

    /**
     * 엘리먼트에 프로그래매틱하게 포커스를 설정합니다.
     * @private
     * @param {?HTMLElement} element - 포커스를 받을 엘리먼트입니다.
     * @param {boolean} [preventScroll=true] - 포커스 시 스크롤 방지 여부입니다.
     */
    _focusElement(element, preventScroll = true) {
        if (!element) return;
        if (element.getAttribute("tabindex") !== "-1" && document.activeElement !== element) {
            // 이미 tabindex가 있거나 자연스럽게 포커스 가능한 요소가 아니라면,
            // 프로그래매틱 포커스를 위해 tabindex=-1 추가 (포커스 가능하게 만들지만 탭 순서에는 포함 안됨)
            if(!element.hasAttribute("tabindex") && !['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) && !element.hasAttribute('contenteditable')) {
                 element.setAttribute("tabindex", "-1");
            }
        }
        element.focus({ preventScroll });
    }

    /** 창 크기 변경 이벤트를 처리합니다. */
    _handleResize() {
        this.isMobile = window.matchMedia("(max-width: 767px)").matches;
        this.headerHeight = this._getHeaderHeight();

        // 현재 활성화된 표준 패널을 찾아 내부 스티키 탭 동작 재초기화
        const elActiveStandardPanel = this.elStandardPanelsContainer.querySelector(
            `.${this.options.standardPanelActiveClass}.${this.options.activeClass}`
        );

        if (elActiveStandardPanel) {
            const elStickyTabsNav = elActiveStandardPanel.querySelector(this.options.stickyTabsNavSelector);
            if (elStickyTabsNav) {
                const stickyTabLinks = elStickyTabsNav.querySelectorAll('.sticky-tabs__link[role="tab"]');
                // IntersectionObserver 재설정
                this._initializeStickyScrollBehavior(elStickyTabsNav, elActiveStandardPanel.id, stickyTabLinks);

                // 활성 스티키 탭이 있다면 중앙으로 스크롤
                const elActiveStickyLink = elStickyTabsNav.querySelector(`.${this.options.stickyLinkActiveClass}`);
                if (elActiveStickyLink) {
                    this._scrollStickyNavToCenter(elStickyTabsNav, elActiveStickyLink);
                }
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new TabSystem();
});