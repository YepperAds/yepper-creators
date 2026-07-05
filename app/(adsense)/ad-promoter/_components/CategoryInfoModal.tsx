'use client';
// @ts-nocheck

// CategoryInfoModal.js
import { X } from 'lucide-react';

import AboveTheFoldContainer from '../_descriptions/aboveTheFold';
import BeneathTitleContainer from '../_descriptions/beneathTitle';
import BottomContainer from '../_descriptions/bottom';
import FloatingContainer from '../_descriptions/floating';
import HeaderPicContainer from '../_descriptions/header';
import InFeedContainer from '../_descriptions/inFeed';
import InlineContentContainer from '../_descriptions/inlineContent';
import LeftRailContainer from '../_descriptions/leftRail';
import MobileInterstialContainer from '../_descriptions/mobileInterstial';
import ModalPicContainer from '../_descriptions/modal';
import OverlayContainer from '../_descriptions/overlay';
import ProFooterContainer from '../_descriptions/proFooter';
import RightRailContainer from '../_descriptions/rightRail';
import SidebarContainer from '../_descriptions/sidebar';
import StickySidebarContainer from '../_descriptions/stickySidebar';
import PrerollContainer from '../_descriptions/preroll';
import MidrollContainer from '../_descriptions/midroll';
import PauseContainer from '../_descriptions/pause';

const CategoryInfoModal = ({  isOpen, onClose, category  }: any) => {
    if (!isOpen) return null;
    // Create a normalized mapping that handles different case variations
    const CategoryComponents = {
        'aboveTheFold': AboveTheFoldContainer,
        'beneathTitle': BeneathTitleContainer,
        'bottom': BottomContainer,
        'floating': FloatingContainer,
        'HeaderPic': HeaderPicContainer,
        'headerPic': HeaderPicContainer, // Add alternative case
        'inFeed': InFeedContainer,
        'infeed': InFeedContainer, // Add alternative case
        'inlineContent': InlineContentContainer,
        'leftRail': LeftRailContainer,
        'mobileInterstial': MobileInterstialContainer,
        'modalPic': ModalPicContainer,
        'overlay': OverlayContainer,
        'proFooter': ProFooterContainer,
        'rightRail': RightRailContainer,
        'sidebar': SidebarContainer,
        'stickySidebar': StickySidebarContainer,
        'preroll': PrerollContainer,
        'midroll': MidrollContainer,
        'pause': PauseContainer
    };

    const CategoryComponent = CategoryComponents[category];

    return (
        <div className="fixed inset-0 backdrop-blur-lg bg-black/60 flex items-center justify-center z-50 overflow-y-auto">
            <div className="relative w-full h-full max-w-7xl mx-auto">
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-50 p-3 bg-surface-1/10 backdrop-blur-xl rounded-full border border-[#fff]/20 text-[#fff]/80 hover:text-[#fff] hover:bg-surface-1/20 transition-all duration-300"
                >
                    <X className="w-6 h-6" />
                </button>
                {CategoryComponent && <CategoryComponent />}
            </div>
        </div>
    );
};

export default CategoryInfoModal;