import Adapt from 'core/js/adapt';
import MediaAutoplayView from './mediaView';
import MediaAutoplayModel from './mediaModel';

export default Adapt.register('media-autoplay', {
  model: MediaAutoplayModel,
  view: MediaAutoplayView
});
